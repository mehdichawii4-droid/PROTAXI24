import type {
  ExpoPushMessage,
  PushEventType,
  PushPayload,
  PushTargetRole,
} from '@/types/pushV2';

const BRAND = 'PROTAXI24';

function baseData(
  eventType: PushEventType,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    eventType,
    brand: BRAND,
    ...extra,
  };
}

export type TaxiPushInput = {
  eventType: Extract<
    PushEventType,
    | 'taxi_new_ride_available'
    | 'taxi_ride_accepted'
    | 'taxi_driver_en_route'
    | 'taxi_driver_arrived'
    | 'taxi_ride_finished'
  >;
  rideId: string;
  clientUid?: string;
  driverId?: string;
  driverName?: string;
  departure?: string;
  destination?: string;
  service?: string;
};

export type TourPushInput = {
  eventType: Extract<
    PushEventType,
    | 'tour_new_booking_admin'
    | 'tour_booking_confirmed'
    | 'tour_booking_cancelled'
    | 'tour_group_assigned'
  >;
  bookingId: string;
  clientUid?: string;
  experience?: string;
  date?: string;
  groupId?: string;
  bookingMode?: string;
};

export type GroupAnnouncementPushInput = {
  groupId: string;
  announcementText: string;
  senderName?: string;
  senderType?: 'admin' | 'guide';
  participantClientUids?: string[];
  experience?: string;
};

function taxiTargetRoles(eventType: PushEventType): PushTargetRole[] {
  if (eventType === 'taxi_new_ride_available') {
    return ['driver'];
  }
  return ['client'];
}

function tourTargetRoles(eventType: PushEventType): PushTargetRole[] {
  if (eventType === 'tour_new_booking_admin') {
    return ['admin'];
  }
  if (eventType === 'tour_group_assigned' || eventType === 'tour_group_announcement') {
    return ['client'];
  }
  return ['client'];
}

export function buildTaxiPushPayload(input: TaxiPushInput): PushPayload {
  const destination = input.destination || input.departure || 'votre destination';
  const driverName = input.driverName || 'Votre chauffeur';

  const copy: Record<TaxiPushInput['eventType'], { title: string; body: string }> = {
    taxi_new_ride_available: {
      title: `${BRAND} • Nouvelle course 🚖`,
      body: `Course disponible vers ${destination}.`,
    },
    taxi_ride_accepted: {
      title: `${BRAND} • Course acceptée ✅`,
      body: `${driverName} a confirmé votre course.`,
    },
    taxi_driver_en_route: {
      title: `${BRAND} • Chauffeur en route 🚗`,
      body: `${driverName} est en route vers vous.`,
    },
    taxi_driver_arrived: {
      title: `${BRAND} • Chauffeur arrivé 📍`,
      body: `${driverName} est au point de prise en charge.`,
    },
    taxi_ride_finished: {
      title: `${BRAND} • Course terminée 🎉`,
      body: 'Merci d’avoir voyagé avec PROTAXI24.',
    },
  };

  const message = copy[input.eventType];

  return {
    eventType: input.eventType,
    title: message.title,
    body: message.body,
    targetRoles: taxiTargetRoles(input.eventType),
    targetUids: input.clientUid && input.eventType !== 'taxi_new_ride_available'
      ? [input.clientUid]
      : undefined,
    data: baseData(input.eventType, {
      rideId: input.rideId,
      ...(input.clientUid ? { clientUid: input.clientUid } : {}),
      ...(input.driverId ? { driverId: input.driverId } : {}),
      ...(input.service ? { service: input.service } : {}),
      ...(input.departure ? { departure: input.departure } : {}),
      ...(input.destination ? { destination: input.destination } : {}),
    }),
  };
}

export function buildTourPushPayload(input: TourPushInput): PushPayload {
  const experience = input.experience || 'Expérience PROTAXI';

  const copy: Record<TourPushInput['eventType'], { title: string; body: string }> = {
    tour_new_booking_admin: {
      title: `${BRAND} • Nouvelle réservation tourisme`,
      body: `${experience} — en attente de validation.`,
    },
    tour_booking_confirmed: {
      title: `${BRAND} • Réservation confirmée ✅`,
      body: `Votre expérience « ${experience} » est confirmée.`,
    },
    tour_booking_cancelled: {
      title: `${BRAND} • Réservation annulée ❌`,
      body: `Votre réservation « ${experience} » n’a pas pu être confirmée.`,
    },
    tour_group_assigned: {
      title: `${BRAND} • Groupe attribué 👥`,
      body: `Vous avez rejoint un groupe pour « ${experience} ».`,
    },
  };

  const message = copy[input.eventType];

  return {
    eventType: input.eventType,
    title: message.title,
    body: message.body,
    targetRoles: tourTargetRoles(input.eventType),
    targetUids:
      input.clientUid && input.eventType !== 'tour_new_booking_admin'
        ? [input.clientUid]
        : undefined,
    data: baseData(input.eventType, {
      bookingId: input.bookingId,
      ...(input.clientUid ? { clientUid: input.clientUid } : {}),
      ...(input.experience ? { experience: input.experience } : {}),
      ...(input.date ? { date: input.date } : {}),
      ...(input.groupId ? { groupId: input.groupId } : {}),
      ...(input.bookingMode ? { bookingMode: input.bookingMode } : {}),
    }),
  };
}

export function buildGroupAnnouncementPushPayload(
  input: GroupAnnouncementPushInput,
): PushPayload {
  const preview =
    input.announcementText.length > 120
      ? `${input.announcementText.slice(0, 117)}...`
      : input.announcementText;

  return {
    eventType: 'tour_group_announcement',
    title: `${BRAND} • Annonce groupe 📣`,
    body: preview,
    targetRoles: ['client'],
    targetUids: input.participantClientUids?.filter(Boolean),
    data: baseData('tour_group_announcement', {
      groupId: input.groupId,
      ...(input.senderName ? { senderName: input.senderName } : {}),
      ...(input.senderType ? { senderType: input.senderType } : {}),
      ...(input.experience ? { experience: input.experience } : {}),
    }),
  };
}

export function toExpoPushMessages(
  payload: PushPayload,
  tokens: string[],
): ExpoPushMessage[] {
  return tokens.map((token) => ({
    to: token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: 'default' as const,
  }));
}

/**
 * TODO(Cloud Function): sendExpoPushNotification
 * Implement in Firebase Functions (Admin SDK) — never from the mobile client.
 *
 * POST https://exp.host/--/api/v2/push/send
 * Headers: Authorization: Bearer <EXPO_ACCESS_TOKEN> (server secret only)
 */
export async function sendExpoPushNotification(_messages: ExpoPushMessage[]): Promise<void> {
  void _messages;
  // Server-only — see Cloud Function migration in project docs.
}
