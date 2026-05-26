import {
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import {
  createTourGroupDocRef,
  getFirestoreDb,
  getTourGroupDocRef,
  getTourGroupsCollectionRef,
} from '@/firebase/firestore';
import { devError, devLog } from '@/utils/devLog';

export const TOUR_GROUP_CAPACITY = 8;
export const DEFAULT_TOUR_GROUP_DISPLAY_NAME = 'Voyageur PROTAXI';
export const TOURISM_GREEN = '#8BC53F';

export type TourGroupStatus = 'open' | 'full';
export type TourGroupParticipantStatus = 'pending' | 'confirmed' | 'cancelled';

export type TourGroupParticipant = {
  bookingId: string;
  displayName: string;
  travelersCount: number;
  joinedAt?: unknown;
  status: TourGroupParticipantStatus | string;
};

export type TourGroupParticipantInput = {
  bookingId: string;
  displayName?: string;
  travelersCount: number;
  status?: TourGroupParticipantStatus | string;
};

export type TourGroupMatchResult = {
  groupId: string;
  booked: number;
  remaining: number;
  capacity: number;
  status: TourGroupStatus;
};

type MatchTourGroupInput = {
  experience: string;
  date: string;
  departure: string;
  meetingPoint: string;
  participant: TourGroupParticipantInput;
};

export function normalizeTourGroupParticipants(raw: unknown): TourGroupParticipant[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (typeof item === 'string') {
        return {
          bookingId: item,
          displayName: DEFAULT_TOUR_GROUP_DISPLAY_NAME,
          travelersCount: 1,
          status: 'pending' as const,
        };
      }

      return {
        bookingId: String(item?.bookingId || ''),
        displayName: String(item?.displayName || DEFAULT_TOUR_GROUP_DISPLAY_NAME),
        travelersCount: Number(item?.travelersCount || 1),
        joinedAt: item?.joinedAt,
        status: String(item?.status || 'pending'),
      };
    })
    .filter((participant) => Boolean(participant.bookingId));
}

function buildParticipantRecord(input: TourGroupParticipantInput): TourGroupParticipant {
  return {
    bookingId: input.bookingId,
    displayName: input.displayName || DEFAULT_TOUR_GROUP_DISPLAY_NAME,
    travelersCount: Number(input.travelersCount || 1),
    joinedAt: new Date().toISOString(),
    status: input.status || 'pending',
  };
}

function logFirestoreError(context: string, error: unknown) {
  devError(`[TourGroupMatching] ${context}`, error);
  devLog(error);

  if (error instanceof Error) {
    devLog(`[TourGroupMatching] ${context} message:`, error.message);
    devLog(`[TourGroupMatching] ${context} stack:`, error.stack);
  }

  if (error && typeof error === 'object' && 'code' in error) {
    devLog(`[TourGroupMatching] ${context} code:`, (error as { code?: string }).code);
  }
}

function serializeParticipantsForFirestore(participants: TourGroupParticipant[]) {
  return participants.map((participant) => ({
    bookingId: participant.bookingId,
    displayName: participant.displayName,
    travelersCount: participant.travelersCount,
    status: participant.status,
    joinedAt:
      typeof participant.joinedAt === 'string'
        ? participant.joinedAt
        : new Date().toISOString(),
  }));
}

async function tryJoinTourGroup(
  groupId: string,
  participantInput: TourGroupParticipantInput,
): Promise<TourGroupMatchResult | null> {
  const normalizedGroupId = groupId.trim();
  const normalizedBookingId = participantInput.bookingId.trim();

  if (!normalizedGroupId) {
    devLog('[TourGroupMatching] tryJoinTourGroup:missingGroupId');
    return null;
  }

  if (!normalizedBookingId) {
    devLog('[TourGroupMatching] tryJoinTourGroup:missingBookingId');
    return null;
  }

  devLog('[TourGroupMatching] tryJoinTourGroup:before', {
    groupId: normalizedGroupId,
    bookingId: normalizedBookingId,
  });

  try {
    const firestore = getFirestoreDb();
    return await runTransaction(firestore, async (transaction) => {
      const groupRef = getTourGroupDocRef(normalizedGroupId);
      const groupSnap = await transaction.get(groupRef);
      if (!groupSnap.exists()) {
        devLog('[TourGroupMatching] tryJoinTourGroup:missingGroup', { groupId: normalizedGroupId });
        return null;
      }

      const data = groupSnap.data();
      const capacity = Number(data.capacity || TOUR_GROUP_CAPACITY);
      const booked = Number(data.booked || 0);

      if (data.status !== 'open' || booked >= capacity) {
        devLog('[TourGroupMatching] tryJoinTourGroup:groupNotJoinable', {
          groupId,
          status: data.status,
          booked,
          capacity,
        });
        return null;
      }

      const participants = normalizeTourGroupParticipants(data.participants);

      if (participants.some((participant) => participant.bookingId === normalizedBookingId)) {
        devLog('[TourGroupMatching] tryJoinTourGroup:alreadyJoined', { groupId: normalizedGroupId });
        return {
          groupId: normalizedGroupId,
          booked,
          remaining: Number(data.remaining ?? capacity - booked),
          capacity,
          status: data.status === 'full' ? 'full' : 'open',
        };
      }

      const newBooked = booked + 1;
      const newRemaining = capacity - newBooked;
      const newStatus: TourGroupStatus = newRemaining <= 0 ? 'full' : 'open';

      participants.push(buildParticipantRecord(participantInput));

      transaction.update(groupRef, {
        participants: serializeParticipantsForFirestore(participants),
        booked: newBooked,
        remaining: newRemaining,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      const result = {
        groupId: normalizedGroupId,
        booked: newBooked,
        remaining: newRemaining,
        capacity,
        status: newStatus,
      };

      devLog('[TourGroupMatching] tryJoinTourGroup:success', result);
      return result;
    });
  } catch (error) {
    logFirestoreError(`tryJoinTourGroup:failed groupId=${normalizedGroupId}`, error);
    return null;
  }
}

async function createTourGroup(input: MatchTourGroupInput): Promise<TourGroupMatchResult> {
  const normalizedBookingId = input.participant.bookingId.trim();
  if (!normalizedBookingId) {
    throw new Error('bookingId is required to create a tour group.');
  }

  devLog('[TourGroupMatching] createTourGroup:before', {
    experience: input.experience,
    date: input.date,
    departure: input.departure,
    meetingPoint: input.meetingPoint,
    bookingId: normalizedBookingId,
  });

  const groupRef = createTourGroupDocRef();
  const firestore = getFirestoreDb();
  const booked = 1;
  const remaining = TOUR_GROUP_CAPACITY - booked;
  const participant = buildParticipantRecord(input.participant);

  try {
    await runTransaction(firestore, async (transaction) => {
      transaction.set(groupRef, {
        experience: input.experience,
        date: input.date,
        departure: input.departure,
        meetingPoint: input.meetingPoint,
        capacity: TOUR_GROUP_CAPACITY,
        booked,
        remaining,
        participants: serializeParticipantsForFirestore([participant]),
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const result = {
      groupId: groupRef.id,
      booked,
      remaining,
      capacity: TOUR_GROUP_CAPACITY,
      status: 'open' as const,
    };

    devLog('[TourGroupMatching] createTourGroup:after', result);
    return result;
  } catch (error) {
    logFirestoreError('createTourGroup:failed', error);
    throw error;
  }
}

export async function matchOrCreateTourGroup(
  input: MatchTourGroupInput,
): Promise<TourGroupMatchResult> {
  const normalizedBookingId = input.participant.bookingId.trim();
  if (!normalizedBookingId) {
    throw new Error('bookingId is required for tour group matching.');
  }

  devLog('[TourGroupMatching] matchOrCreateTourGroup:before', {
    experience: input.experience,
    date: input.date,
    departure: input.departure,
    meetingPoint: input.meetingPoint,
    bookingId: normalizedBookingId,
  });

  let snapshot;

  try {
    const openGroupsQuery = query(
      getTourGroupsCollectionRef(),
      where('status', '==', 'open'),
    );
    devLog('[TourGroupMatching] matchOrCreateTourGroup:query', { status: 'open' });
    snapshot = await getDocs(openGroupsQuery);
    devLog('[TourGroupMatching] matchOrCreateTourGroup:queryResult', {
      totalOpenGroups: snapshot.size,
    });
  } catch (error) {
    logFirestoreError('matchOrCreateTourGroup:query failed, fallback to full collection read', error);
    snapshot = await getDocs(getTourGroupsCollectionRef());
    devLog('[TourGroupMatching] matchOrCreateTourGroup:fallbackResult', {
      totalGroups: snapshot.size,
    });
  }

  const matchingGroups = snapshot.docs.filter((groupDoc) => {
    const data = groupDoc.data();
    return data.experience === input.experience && data.date === input.date;
  });

  devLog('[TourGroupMatching] matchOrCreateTourGroup:matchingGroups', {
    count: matchingGroups.length,
    ids: matchingGroups.map((groupDoc) => groupDoc.id),
  });

  for (const groupDoc of matchingGroups) {
    const joined = await tryJoinTourGroup(groupDoc.id, input.participant);
    devLog('[TourGroupMatching] matchOrCreateTourGroup:tryJoinResult', {
      groupId: groupDoc.id,
      joined: Boolean(joined),
    });
    if (joined) {
      devLog('[TourGroupMatching] matchOrCreateTourGroup:afterJoin', joined);
      return joined;
    }
  }

  const created = await createTourGroup(input);
  devLog('[TourGroupMatching] matchOrCreateTourGroup:afterCreate', created);
  return created;
}

export function formatTourGroupNumber(groupId: string) {
  if (!groupId) return '—';
  return `#${groupId.slice(-6).toUpperCase()}`;
}

export function formatParticipantStatusLabel(status?: string) {
  switch (status) {
    case 'confirmed':
      return 'Confirmée';
    case 'cancelled':
      return 'Annulée';
    default:
      return 'En attente';
  }
}

export const TOUR_GROUP_VEHICLE_OPTIONS = [
  'Van Premium',
  'Minibus VIP',
  'SUV Groupe',
] as const;

export const TOUR_GROUP_DRIVER_OPTIONS = ['Mehdi', 'Chauffeur PROTAXI'] as const;

export const TOUR_GROUP_GUIDE_OPTIONS = [
  'Guide local Guelma',
  'Guide historique',
] as const;

export type TourGroupAssignmentStatus = 'pending' | 'assigned';

export type TourGroupAssignment = {
  assignedVehicle?: string;
  assignedDriver?: string;
  assignedGuide?: string;
  assignmentStatus?: TourGroupAssignmentStatus | string;
};

export function hasTourGroupAssignment(assignment: TourGroupAssignment) {
  return Boolean(
    assignment.assignedVehicle || assignment.assignedDriver || assignment.assignedGuide,
  );
}

export function isTourGroupAssignmentConfirmed(assignment: TourGroupAssignment) {
  return (
    assignment.assignmentStatus === 'assigned' ||
    Boolean(
      assignment.assignedVehicle && assignment.assignedDriver && assignment.assignedGuide,
    )
  );
}

export type TourGroupTrackingStatus =
  | 'preparing'
  | 'on-the-way'
  | 'arrived'
  | 'in-tour'
  | 'completed';

export type TourGroupLiveLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

export type TourGroupTracking = {
  trackingStatus?: TourGroupTrackingStatus | string;
  etaMinutes?: number;
  liveLocation?: TourGroupLiveLocation;
  lastLocationUpdate?: unknown;
};

const TRACKING_STATUS_VALUES: TourGroupTrackingStatus[] = [
  'preparing',
  'on-the-way',
  'arrived',
  'in-tour',
  'completed',
];

export function normalizeTourGroupTrackingStatus(
  value: unknown,
): TourGroupTrackingStatus | '' {
  if (typeof value !== 'string') return '';
  return TRACKING_STATUS_VALUES.includes(value as TourGroupTrackingStatus)
    ? (value as TourGroupTrackingStatus)
    : '';
}

export function getTourGroupTrackingConfig(status: TourGroupTrackingStatus | string) {
  switch (status) {
    case 'on-the-way':
      return {
        label: 'En route',
        message: 'Le véhicule groupe se dirige vers le rendez-vous collectif.',
        color: '#3B82F6',
        glow: 'rgba(59,130,246,0.18)',
        border: 'rgba(59,130,246,0.32)',
        icon: 'navigate' as const,
        mapLeft: '46%',
        mapTop: '48%',
      };
    case 'arrived':
      return {
        label: 'Arrivé',
        message: 'Le véhicule est arrivé au point de rendez-vous.',
        color: TOURISM_GREEN,
        glow: 'rgba(139,197,63,0.22)',
        border: 'rgba(139,197,63,0.32)',
        icon: 'location' as const,
        mapLeft: '72%',
        mapTop: '36%',
      };
    case 'in-tour':
      return {
        label: 'Circuit en cours',
        message: 'Votre expérience touristique est en cours.',
        color: '#A78BFA',
        glow: 'rgba(167,139,250,0.18)',
        border: 'rgba(167,139,250,0.32)',
        icon: 'compass' as const,
        mapLeft: '58%',
        mapTop: '26%',
      };
    case 'completed':
      return {
        label: 'Terminé',
        message: 'Le trajet groupe est terminé.',
        color: '#9CA3AF',
        glow: 'rgba(156,163,175,0.16)',
        border: 'rgba(156,163,175,0.28)',
        icon: 'checkmark-done' as const,
        mapLeft: '72%',
        mapTop: '36%',
      };
    default:
      return {
        label: 'Préparation',
        message: 'Le véhicule groupe est en préparation.',
        color: '#F59E0B',
        glow: 'rgba(245,158,11,0.18)',
        border: 'rgba(245,158,11,0.32)',
        icon: 'time' as const,
        mapLeft: '22%',
        mapTop: '68%',
      };
  }
}

export function getMockTrackingLocation(
  status: TourGroupTrackingStatus,
): TourGroupLiveLocation {
  switch (status) {
    case 'on-the-way':
      return {
        latitude: 36.462,
        longitude: 7.426,
        label: 'En route vers rendez-vous',
      };
    case 'arrived':
      return {
        latitude: 36.46,
        longitude: 7.424,
        label: 'Place du 1er Novembre — Guelma',
      };
    case 'in-tour':
      return {
        latitude: 36.455,
        longitude: 7.42,
        label: 'Circuit touristique Guelma',
      };
    case 'completed':
      return {
        latitude: 36.46,
        longitude: 7.424,
        label: 'Retour point de départ',
      };
    default:
      return {
        latitude: 36.468,
        longitude: 7.431,
        label: 'Base PROTAXI Guelma',
      };
  }
}

export function getMockTrackingEta(status: TourGroupTrackingStatus) {
  switch (status) {
    case 'on-the-way':
      return 12;
    case 'arrived':
    case 'completed':
      return 0;
    case 'in-tour':
      return 45;
    default:
      return 0;
  }
}

export function normalizeTourGroupTracking(raw: Record<string, unknown>): TourGroupTracking {
  const trackingStatus = normalizeTourGroupTrackingStatus(raw.trackingStatus);
  const liveLocationRaw = raw.liveLocation;

  let liveLocation: TourGroupLiveLocation | undefined;
  if (liveLocationRaw && typeof liveLocationRaw === 'object') {
    const location = liveLocationRaw as Record<string, unknown>;
    liveLocation = {
      latitude: Number(location.latitude || 36.462),
      longitude: Number(location.longitude || 7.426),
      label: String(location.label || 'Guelma'),
    };
  } else if (trackingStatus) {
    liveLocation = getMockTrackingLocation(trackingStatus);
  }

  return {
    trackingStatus: trackingStatus || undefined,
    etaMinutes: Number(raw.etaMinutes ?? (trackingStatus ? getMockTrackingEta(trackingStatus) : 0)),
    liveLocation,
    lastLocationUpdate: raw.lastLocationUpdate,
  };
}

export function hasTourGroupTracking(tracking: TourGroupTracking) {
  return Boolean(normalizeTourGroupTrackingStatus(tracking.trackingStatus));
}

export const TOUR_GROUP_TRACKING_OPTIONS: Array<{
  status: TourGroupTrackingStatus;
  label: string;
}> = [
  { status: 'preparing', label: 'Préparation' },
  { status: 'on-the-way', label: 'En route' },
  { status: 'arrived', label: 'Arrivé' },
  { status: 'in-tour', label: 'Circuit en cours' },
  { status: 'completed', label: 'Terminé' },
];
