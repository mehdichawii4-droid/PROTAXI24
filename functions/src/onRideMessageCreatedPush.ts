import * as admin from 'firebase-admin';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';

/** Must match `RIDE_CHAT_MESSAGE_EVENT` in app pushNotificationRouting.ts */
const RIDE_CHAT_MESSAGE_EVENT = 'taxi_ride_chat_message';

const CHAT_PUSH_TITLE = 'PROTAXI — Nouveau message';
const PREVIEW_MAX_LENGTH = 60;

const expo = new Expo();

type RideMessageSenderRole = 'client' | 'driver';

function normalizeSenderRole(value: unknown): RideMessageSenderRole {
  return value === 'driver' ? 'driver' : 'client';
}

function buildMessagePreview(text: unknown): string {
  const trimmed = String(text ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return 'Nouveau message sur votre course';
  }
  if (trimmed.length <= PREVIEW_MAX_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, PREVIEW_MAX_LENGTH - 1)}…`;
}

async function readDriverExpoPushToken(driverId: string): Promise<string | null> {
  const snapshot = await admin.firestore().doc(`drivers/${driverId}`).get();

  if (!snapshot.exists) {
    logger.warn('[PUSH FN][CHAT] token missing', {
      driverId,
      collection: 'drivers',
      reason: 'profile_not_found',
    });
    return null;
  }

  const token = snapshot.data()?.expoPushToken;
  if (typeof token !== 'string' || !token.trim()) {
    logger.warn('[PUSH FN][CHAT] token missing', {
      driverId,
      collection: 'drivers',
      reason: 'expoPushToken_empty',
    });
    return null;
  }

  const trimmed = token.trim();
  logger.info('[PUSH FN][CHAT] token found', {
    driverId,
    collection: 'drivers',
    pushTokenPreview: `${trimmed.slice(0, 24)}…`,
  });
  return trimmed;
}

async function readClientExpoPushToken(clientUid: string): Promise<string | null> {
  const snapshot = await admin.firestore().doc(`users/${clientUid}`).get();

  if (!snapshot.exists) {
    logger.warn('[PUSH FN][CHAT] token missing', {
      clientUid,
      collection: 'users',
      reason: 'profile_not_found',
    });
    return null;
  }

  const token = snapshot.data()?.expoPushToken;
  if (typeof token !== 'string' || !token.trim()) {
    logger.warn('[PUSH FN][CHAT] token missing', {
      clientUid,
      collection: 'users',
      reason: 'expoPushToken_empty',
    });
    return null;
  }

  const trimmed = token.trim();
  logger.info('[PUSH FN][CHAT] token found', {
    clientUid,
    collection: 'users',
    pushTokenPreview: `${trimmed.slice(0, 24)}…`,
  });
  return trimmed;
}

async function sendChatExpoPush(params: {
  rideId: string;
  recipientId: string;
  recipientRole: 'driver' | 'client';
  pushToken: string;
  body: string;
  driverId: string | null;
  clientUid: string | null;
  status: string;
}): Promise<void> {
  const {
    rideId,
    recipientId,
    recipientRole,
    pushToken,
    body,
    driverId,
    clientUid,
    status,
  } = params;

  if (!Expo.isExpoPushToken(pushToken)) {
    const invalidPreview = String(pushToken).slice(0, 24);
    logger.warn('[PUSH FN][CHAT] skip — invalid Expo push token format', {
      rideId,
      recipientRole,
      recipientId,
      pushTokenPreview: `${invalidPreview}…`,
    });
    return;
  }

  const message: ExpoPushMessage = {
    to: pushToken,
    title: CHAT_PUSH_TITLE,
    body,
    sound: 'default',
    data: {
      eventType: RIDE_CHAT_MESSAGE_EVENT,
      rideId,
      openChat: '1',
      driverId,
      clientUid,
      status,
    },
  };

  logger.info('[PUSH FN][CHAT] push sent — requesting Expo ticket', {
    rideId,
    recipientRole,
    recipientId,
    eventType: RIDE_CHAT_MESSAGE_EVENT,
    pushTokenPreview: `${pushToken.slice(0, 24)}…`,
  });

  try {
    const tickets = await expo.sendPushNotificationsAsync([message]);
    const firstTicket = tickets[0];

    logger.info('[PUSH FN][CHAT] push sent', {
      rideId,
      recipientRole,
      recipientId,
      ticketCount: tickets.length,
    });
    logger.info('[PUSH FN][CHAT] expo ticket', {
      rideId,
      recipientRole,
      recipientId,
      ticketStatus: firstTicket?.status ?? null,
      ticketId: firstTicket?.status === 'ok' ? firstTicket.id : null,
      ticketMessage:
        firstTicket?.status === 'error' ? firstTicket.message ?? null : null,
    });
  } catch (error) {
    logger.error('[PUSH FN][CHAT] Expo push failed', {
      rideId,
      recipientRole,
      recipientId,
      error,
    });
    throw error;
  }
}

export const onRideMessageCreatedPush = onDocumentCreated(
  {
    document: 'rides/{rideId}/messages/{messageId}',
    region: 'europe-west1',
  },
  async (event) => {
    const rideId = String(event.params.rideId ?? '').trim();
    const messageId = String(event.params.messageId ?? '').trim();
    const message = event.data?.data();

    logger.info('[PUSH FN][CHAT] trigger fired', { rideId, messageId });

    if (!message) {
      logger.info('[PUSH FN][CHAT] skip — missing message snapshot', { rideId, messageId });
      return;
    }

    const senderId = String(message.senderId ?? '').trim();
    const senderRole = normalizeSenderRole(message.senderRole);
    const previewBody = buildMessagePreview(message.text);

    if (!senderId) {
      logger.info('[PUSH FN][CHAT] skip — missing senderId', { rideId, messageId });
      return;
    }

    const rideSnap = await admin.firestore().doc(`rides/${rideId}`).get();
    if (!rideSnap.exists) {
      logger.info('[PUSH FN][CHAT] skip — ride not found', { rideId, messageId });
      return;
    }

    const ride = rideSnap.data() ?? {};
    const rideDriverId = String(ride.driverId ?? '').trim();
    const rideClientUid = String(ride.clientUid ?? '').trim();
    const rideStatus = String(ride.status ?? '');

    let recipientRole: 'driver' | 'client' | null = null;
    let recipientId = '';

    if (senderRole === 'client') {
      recipientRole = 'driver';
      recipientId = rideDriverId;
    } else {
      recipientRole = 'client';
      recipientId = rideClientUid;
    }

    logger.info('[PUSH FN][CHAT] recipient resolved', {
      rideId,
      messageId,
      senderId,
      senderRole,
      recipientRole,
      recipientId: recipientId || null,
    });

    if (!recipientId) {
      logger.info('[PUSH FN][CHAT] skip — recipient id missing', {
        rideId,
        messageId,
        senderRole,
        recipientRole,
      });
      return;
    }

    if (recipientId === senderId) {
      logger.info('[PUSH FN][CHAT] skip — would notify sender', {
        rideId,
        messageId,
        senderId,
      });
      return;
    }

    const pushToken =
      recipientRole === 'driver'
        ? await readDriverExpoPushToken(recipientId)
        : await readClientExpoPushToken(recipientId);

    if (!pushToken) {
      return;
    }

    await sendChatExpoPush({
      rideId,
      recipientId,
      recipientRole,
      pushToken,
      body: previewBody,
      driverId: rideDriverId || null,
      clientUid: rideClientUid || null,
      status: rideStatus,
    });
  },
);
