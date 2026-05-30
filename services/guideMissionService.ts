import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type Query,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import {
  getTourBookingStatusConfig,
  normalizeTourBookingRecord,
} from '@/services/tourBookingHistory';
import type { GuideMissionItem } from '@/types/guide';
import { devError, devLog } from '@/utils/devLog';

export function buildGuideMissionsQuery(guideUid: string): Query {
  const normalizedUid = guideUid.trim();
  if (!normalizedUid) {
    throw new Error('Guide uid required for missions query.');
  }

  return query(
    collection(db, 'tourBookings'),
    where('assignedGuideId', '==', normalizedUid),
    orderBy('createdAt', 'desc'),
  );
}

export function normalizeGuideMission(id: string, raw: Record<string, unknown>): GuideMissionItem {
  const booking = normalizeTourBookingRecord(id, raw);
  const statusConfig = getTourBookingStatusConfig(booking.status);

  return {
    id: booking.id,
    experience: booking.experience || booking.circuitName || 'Expérience PROTAXI',
    date: booking.date || 'À confirmer',
    meetingPoint: booking.meetingPoint || '—',
    clientName: String(raw.clientName ?? '').trim() || 'Client PROTAXI',
    travelers: booking.travelers || '1',
    status: booking.status || 'pending',
    statusLabel: statusConfig.label,
    statusColor: statusConfig.color,
    statusBg: statusConfig.bg,
    statusBorder: statusConfig.border,
    createdAtMs: toCreatedAtMs(booking.createdAt),
  };
}

function toCreatedAtMs(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const date = (value as { toDate?: () => Date }).toDate?.();
    return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
  }
  return 0;
}

export function subscribeGuideMissions(
  guideUid: string,
  onData: (missions: GuideMissionItem[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const normalizedUid = guideUid.trim();

  devLog('[GUIDE MISSIONS] subscribe', { guideUid: normalizedUid });

  return onSnapshot(
    buildGuideMissionsQuery(normalizedUid),
    (snapshot) => {
      const missions = snapshot.docs.map((docSnap) =>
        normalizeGuideMission(docSnap.id, docSnap.data() as Record<string, unknown>),
      );
      onData(missions);
    },
    (error) => {
      devError('[GUIDE MISSIONS] snapshot failed', error);
      onError?.(error);
    },
  );
}
