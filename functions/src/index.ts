import * as admin from 'firebase-admin';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { attemptAutoDispatchForRide } from './autoDispatch';

admin.initializeApp();

const LOGIN_LOOKUP_COLLECTIONS = ['admins', 'drivers', 'partners', 'users'] as const;

function normalizePhoneLookup(phone: string): string {
  return phone.replace(/\s/g, '').replace(/^0/, '+213');
}

function normalizeEmailLookup(email: string): string {
  return email.trim().toLowerCase();
}

async function findEmailByField(
  field: 'email' | 'phone',
  value: string,
): Promise<string | null> {
  const db = admin.firestore();

  for (const collectionName of LOGIN_LOOKUP_COLLECTIONS) {
    const snapshot = await db
      .collection(collectionName)
      .where(field, '==', value)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const email = String(snapshot.docs[0].data()?.email ?? '').trim().toLowerCase();
      return email || null;
    }
  }

  return null;
}

export const resolveLoginIdentifier = onCall(
  {
    region: 'europe-west1',
    invoker: 'public',
  },
  async (request) => {
    const rawEmail = typeof request.data?.email === 'string' ? request.data.email : '';
    const rawPhone = typeof request.data?.phone === 'string' ? request.data.phone : '';
    const hasEmail = rawEmail.trim().length > 0;
    const hasPhone = rawPhone.trim().length > 0;

    if (hasEmail === hasPhone) {
      throw new HttpsError(
        'invalid-argument',
        'Provide exactly one of email or phone.',
      );
    }

    try {
      if (hasEmail) {
        const email = normalizeEmailLookup(rawEmail);
        if (!email.includes('@') || email.length > 320) {
          throw new HttpsError('invalid-argument', 'Invalid email.');
        }

        const resolved = await findEmailByField('email', email);
        return { found: Boolean(resolved), email: resolved };
      }

      const phone = normalizePhoneLookup(rawPhone);
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 8 || digits.length > 15) {
        throw new HttpsError('invalid-argument', 'Invalid phone.');
      }

      const resolved = await findEmailByField('phone', phone);
      if (!resolved) {
        return { found: false, email: null };
      }

      return { found: true, email: resolved };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('[resolveLoginIdentifier] failed', { error });
      throw new HttpsError('internal', 'Lookup failed.');
    }
  },
);

const expo = new Expo();

type PushTarget = 'driver' | 'client';

interface TransitionRule {
  from: string;
  to: string;
  target: PushTarget;
  title: string;
  body: string;
  eventType: string;
}

const CLIENT_TRANSITIONS: TransitionRule[] = [
  {
    from: 'Attribuée',
    to: 'Acceptée',
    target: 'client',
    title: 'Course acceptée ✅',
    body: 'Votre chauffeur arrive bientôt.',
    eventType: 'taxi_ride_accepted',
  },
  {
    from: 'Acceptée',
    to: 'En route',
    target: 'client',
    title: 'Chauffeur en route 🚖',
    body: 'Votre chauffeur se dirige vers vous.',
    eventType: 'taxi_driver_en_route',
  },
  {
    from: 'En route',
    to: 'Arrivé',
    target: 'client',
    title: 'Chauffeur arrivé 📍',
    body: 'Votre chauffeur est arrivé au point de prise en charge.',
    eventType: 'taxi_driver_arrived',
  },
  {
    from: 'Arrivé',
    to: 'Terminée',
    target: 'client',
    title: 'Course terminée ✅',
    body: 'Merci d’avoir choisi PROTAXI. Vous pouvez noter votre chauffeur.',
    eventType: 'taxi_ride_finished',
  },
];

function normalizeStatus(status: unknown): string {
  const raw = String(status ?? '').trim();
  const lower = raw.toLowerCase();

  if (lower === 'en attente') return 'En attente';
  if (lower === 'attribuée' || lower === 'attribuee') return 'Attribuée';
  if (lower === 'acceptée' || lower === 'acceptee') return 'Acceptée';
  if (lower === 'en route') return 'En route';
  if (lower === 'arrivé' || lower === 'arrive') return 'Arrivé';
  if (lower === 'terminée' || lower === 'terminee') return 'Terminée';
  if (lower === 'refusée' || lower === 'refusee') return 'Refusée';

  return raw;
}

function readLocationLabel(value: unknown, fallback: string): string {
  const label = String(value ?? '').trim();
  return label || fallback;
}

async function readDriverExpoPushToken(driverId: string): Promise<string | null> {
  const snapshot = await admin.firestore().doc(`drivers/${driverId}`).get();

  if (!snapshot.exists) {
    logger.warn('[PUSH FN] token missing', {
      driverId,
      collection: 'drivers',
      reason: 'profile_not_found',
    });
    return null;
  }

  const token = snapshot.data()?.expoPushToken;
  if (typeof token !== 'string' || !token.trim()) {
    logger.warn('[PUSH FN] token missing', {
      driverId,
      collection: 'drivers',
      reason: 'expoPushToken_empty',
    });
    return null;
  }

  const trimmed = token.trim();
  logger.info('[PUSH FN] token found', {
    driverId,
    collection: 'drivers',
    pushTokenPreview: `${trimmed.slice(0, 24)}…`,
  });
  return trimmed;
}

async function readClientExpoPushToken(clientUid: string): Promise<string | null> {
  const snapshot = await admin.firestore().doc(`users/${clientUid}`).get();

  if (!snapshot.exists) {
    logger.warn('[PUSH FN] token missing', {
      clientUid,
      collection: 'users',
      reason: 'profile_not_found',
    });
    return null;
  }

  const token = snapshot.data()?.expoPushToken;
  if (typeof token !== 'string' || !token.trim()) {
    logger.warn('[PUSH FN] token missing', {
      clientUid,
      collection: 'users',
      reason: 'expoPushToken_empty',
    });
    return null;
  }

  const trimmed = token.trim();
  logger.info('[PUSH FN] token found', {
    clientUid,
    collection: 'users',
    pushTokenPreview: `${trimmed.slice(0, 24)}…`,
  });
  return trimmed;
}

function findClientTransition(
  beforeStatus: string,
  afterStatus: string,
): TransitionRule | null {
  return (
    CLIENT_TRANSITIONS.find(
      (rule) => rule.from === beforeStatus && rule.to === afterStatus,
    ) ?? null
  );
}

async function sendExpoPush(params: {
  rideId: string;
  recipientId: string;
  recipientRole: PushTarget;
  pushToken: string;
  title: string;
  body: string;
  eventType: string;
  driverId?: string | null;
  clientUid?: string | null;
  status: string;
}): Promise<void> {
  const {
    rideId,
    recipientId,
    recipientRole,
    pushToken,
    title,
    body,
    eventType,
    driverId,
    clientUid,
    status,
  } = params;

  if (!Expo.isExpoPushToken(pushToken)) {
    const invalidPreview = String(pushToken).slice(0, 24);
    logger.warn('[PUSH FN] skip — invalid Expo push token format', {
      rideId,
      recipientRole,
      recipientId,
      pushTokenPreview: `${invalidPreview}…`,
    });
    return;
  }

  const message: ExpoPushMessage = {
    to: pushToken,
    title,
    body,
    sound: 'default',
    data: {
      eventType,
      rideId,
      driverId: driverId ?? null,
      clientUid: clientUid ?? null,
      status,
    },
  };

  logger.info('[PUSH FN] push sent — requesting Expo ticket', {
    rideId,
    recipientRole,
    recipientId,
    eventType,
    title: message.title,
    body: message.body,
    pushTokenPreview: `${pushToken.slice(0, 24)}…`,
  });

  try {
    const tickets = await expo.sendPushNotificationsAsync([message]);

    const firstTicket = tickets[0];
    logger.info('[PUSH FN] push sent', {
      rideId,
      recipientRole,
      recipientId,
      eventType,
      ticketCount: tickets.length,
    });
    logger.info('[PUSH FN] expo ticket', {
      rideId,
      recipientRole,
      recipientId,
      eventType,
      ticketStatus: firstTicket?.status ?? null,
      ticketId: firstTicket?.status === 'ok' ? firstTicket.id : null,
      ticketMessage:
        firstTicket?.status === 'error' ? firstTicket.message ?? null : null,
    });
  } catch (error) {
    logger.error('[PUSH FN] Expo push failed', {
      rideId,
      recipientRole,
      recipientId,
      eventType,
      error,
    });
    throw error;
  }
}

export const onRideUpdatedPush = onDocumentUpdated(
  {
    document: 'rides/{rideId}',
    region: 'europe-west1',
  },
  async (event) => {
    const rideId = event.params.rideId;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      logger.info('[PUSH FN] skip — missing before/after snapshot', { rideId });
      return;
    }

    const beforeStatus = normalizeStatus(before.status);
    const afterStatus = normalizeStatus(after.status);

    logger.info('[PUSH FN] ride update received', {
      rideId,
      beforeStatus,
      afterStatus,
      driverId: after.driverId ?? null,
      clientUid: after.clientUid ?? null,
    });

    if (beforeStatus === afterStatus) {
      logger.info('[PUSH FN] skip — status unchanged', {
        rideId,
        status: afterStatus,
      });
      return;
    }

    if (beforeStatus === 'En attente' && afterStatus === 'Attribuée') {
      logger.info('[PUSH FN] trigger fired', {
        rideId,
        transition: 'En attente → Attribuée',
        driverId: after.driverId ?? null,
      });

      const driverId = String(after.driverId ?? '').trim();
      if (!driverId) {
        logger.warn('[PUSH FN] skip — missing driverId on assigned ride', { rideId });
        return;
      }

      const pushToken = await readDriverExpoPushToken(driverId);
      if (!pushToken) {
        logger.warn('[PUSH FN] push skipped — token missing', { rideId, driverId });
        return;
      }

      const departure = readLocationLabel(after.departure ?? after.address, 'Départ');
      const destination = readLocationLabel(
        after.destination ?? after.airport,
        'Destination',
      );

      await sendExpoPush({
        rideId,
        recipientId: driverId,
        recipientRole: 'driver',
        pushToken,
        title: 'Nouvelle course PROTAXI 🚖',
        body: `${departure} → ${destination}`,
        eventType: 'taxi_ride_assigned',
        driverId,
        clientUid: after.clientUid ? String(after.clientUid) : null,
        status: afterStatus,
      });
      return;
    }

    const clientTransition = findClientTransition(beforeStatus, afterStatus);
    if (!clientTransition) {
      logger.info('[PUSH FN] skip — no push rule for transition', {
        rideId,
        beforeStatus,
        afterStatus,
      });
      return;
    }

    const clientUid = String(after.clientUid ?? '').trim();
    if (!clientUid) {
      logger.warn('[PUSH FN] skip — missing clientUid on ride', { rideId });
      return;
    }

    const pushToken = await readClientExpoPushToken(clientUid);
    if (!pushToken) {
      return;
    }

    await sendExpoPush({
      rideId,
      recipientId: clientUid,
      recipientRole: 'client',
      pushToken,
      title: clientTransition.title,
      body: clientTransition.body,
      eventType: clientTransition.eventType,
      driverId: after.driverId ? String(after.driverId) : null,
      clientUid,
      status: afterStatus,
    });
  },
);

function readRideRating(value: unknown): number | null {
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return null;
  }
  return rating;
}

export const onRideRated = onDocumentUpdated(
  {
    document: 'rides/{rideId}',
    region: 'europe-west1',
  },
  async (event) => {
    const rideId = event.params.rideId;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      logger.info('[RATING FN] skip — missing before/after snapshot', { rideId });
      return;
    }

    const beforeRating = readRideRating(before.rating);
    const afterRating = readRideRating(after.rating);

    if (beforeRating != null || afterRating == null) {
      return;
    }

    const driverId = String(after.ratedDriverId ?? after.driverId ?? '').trim();
    if (!driverId) {
      logger.warn('[RATING FN] skip — missing driverId on rated ride', { rideId });
      return;
    }

    const comment = String(after.comment ?? '').trim();
    const db = admin.firestore();
    const driverLiveRef = db.doc(`driversLive/${driverId}`);
    const driverProfileRef = db.doc(`drivers/${driverId}`);

    await db.runTransaction(async (transaction) => {
      const driverLiveSnap = await transaction.get(driverLiveRef);

      if (driverLiveSnap.exists && driverLiveSnap.data()?.lastRatingRideId === rideId) {
        logger.info('[RATING FN] skip — ride already aggregated', { rideId, driverId });
        return;
      }

      const oldCount = driverLiveSnap.exists
        ? Number(driverLiveSnap.data()?.ratingsCount || 0)
        : 0;
      const oldTotal = driverLiveSnap.exists
        ? Number(driverLiveSnap.data()?.ratingsTotal || 0)
        : 0;

      const newCount = oldCount + 1;
      const newTotal = oldTotal + afterRating;
      const averageRating = newTotal / newCount;
      const updatedAt = admin.firestore.FieldValue.serverTimestamp();

      transaction.set(
        driverLiveRef,
        {
          ratingsCount: newCount,
          ratingsTotal: newTotal,
          averageRating,
          lastRating: afterRating,
          lastComment: comment,
          lastRatingRideId: rideId,
          updatedAt,
        },
        { merge: true },
      );

      transaction.set(
        driverProfileRef,
        {
          ratingAverage: averageRating,
          ratingCount: newCount,
          totalRatingPoints: newTotal,
          updatedAt,
        },
        { merge: true },
      );
    });

    logger.info('[RATING FN] driver stats updated', {
      rideId,
      driverId,
      rating: afterRating,
      commentLength: comment.length,
    });
  },
);

const ASSIGNMENT_TIMEOUT_SECONDS = 45;
const MAX_AUTO_REDISPATCH = 3;

function readTimestampMillis(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof admin.firestore.Timestamp) {
    return value.toMillis();
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isFinite(date.getTime()) ? date.getTime() : null;
  }
  return null;
}

async function notifyAdminsOptional(params: {
  rideId: string;
  title: string;
  body: string;
  eventType: string;
}): Promise<void> {
  const adminsSnap = await admin.firestore().collection('admins').get();
  const messages: ExpoPushMessage[] = [];

  adminsSnap.forEach((adminDoc) => {
    const token = adminDoc.data()?.expoPushToken;
    if (typeof token !== 'string' || !Expo.isExpoPushToken(token.trim())) {
      return;
    }

    messages.push({
      to: token.trim(),
      title: params.title,
      body: params.body,
      sound: 'default',
      data: {
        eventType: params.eventType,
        rideId: params.rideId,
      },
    });
  });

  if (messages.length === 0) {
    logger.info('[REDISPATCH AUTO] skip admin push — no valid admin tokens', {
      rideId: params.rideId,
    });
    return;
  }

  try {
    const tickets = await expo.sendPushNotificationsAsync(messages);
    logger.info('[REDISPATCH AUTO] admin push sent', {
      rideId: params.rideId,
      eventType: params.eventType,
      ticketCount: tickets.length,
    });
  } catch (error) {
    logger.warn('[REDISPATCH AUTO] admin push failed', {
      rideId: params.rideId,
      error,
    });
  }
}

async function releaseDriverLive(
  transaction: admin.firestore.Transaction,
  driverId: string,
): Promise<void> {
  if (!driverId) return;

  const liveRef = admin.firestore().doc(`driversLive/${driverId}`);
  transaction.set(
    liveRef,
    {
      isBusy: false,
      currentRideId: '',
      availability: 'available',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export const onRideAssignmentTimeout = onSchedule(
  {
    schedule: 'every 1 minutes',
    region: 'europe-west1',
    timeZone: 'Africa/Algiers',
  },
  async () => {
    const db = admin.firestore();
    const nowMs = Date.now();
    const cutoffMs = nowMs - ASSIGNMENT_TIMEOUT_SECONDS * 1000;
    const cutoff = admin.firestore.Timestamp.fromMillis(cutoffMs);

    const snapshot = await db
      .collection('rides')
      .where('status', '==', 'Attribuée')
      .where('assignedAt', '<', cutoff)
      .get();

    if (snapshot.empty) {
      logger.info('[REDISPATCH AUTO] no timed-out assigned rides');
      return;
    }

    logger.info('[REDISPATCH AUTO] scan', {
      candidateCount: snapshot.size,
      timeoutSeconds: ASSIGNMENT_TIMEOUT_SECONDS,
    });

    for (const rideDoc of snapshot.docs) {
      const rideId = rideDoc.id;
      let outcome: 'returned' | 'expired' | 'skipped' = 'skipped';
      let redispatchCount = 0;
      let driverId = '';

      try {
        outcome = await db.runTransaction(async (transaction) => {
          const freshSnap = await transaction.get(rideDoc.ref);
          if (!freshSnap.exists) {
            return 'skipped';
          }

          const ride = freshSnap.data() ?? {};
          const status = normalizeStatus(ride.status);
          if (status !== 'Attribuée') {
            return 'skipped';
          }

          const assignedAtMs = readTimestampMillis(ride.assignedAt);
          if (assignedAtMs == null || assignedAtMs > cutoffMs) {
            return 'skipped';
          }

          driverId = String(ride.driverId ?? '').trim();
          redispatchCount = Number(ride.redispatchCount ?? 0) + 1;
          const updatedAt = admin.firestore.FieldValue.serverTimestamp();

          if (redispatchCount >= MAX_AUTO_REDISPATCH) {
            const expireUpdate: Record<string, unknown> = {
              status: 'Expirée',
              driverId: '',
              driverName: '',
              driverPhone: '',
              driverPhoto: '',
              driverPlate: '',
              driverCar: '',
              redispatchCount,
              expiredAt: updatedAt,
              updatedAt,
            };
            if (driverId) {
              expireUpdate.rejectedDriverIds = admin.firestore.FieldValue.arrayUnion(driverId);
            }
            transaction.update(rideDoc.ref, expireUpdate);
            await releaseDriverLive(transaction, driverId);
            return 'expired';
          }

          const returnUpdate: Record<string, unknown> = {
            status: 'En attente',
            driverId: '',
            driverName: '',
            driverPhone: '',
            driverPhoto: '',
            driverPlate: '',
            driverCar: '',
            redispatchCount,
            lastAutoRedispatchAt: updatedAt,
            updatedAt,
          };
          if (driverId) {
            returnUpdate.rejectedDriverIds = admin.firestore.FieldValue.arrayUnion(driverId);
          }
          transaction.update(rideDoc.ref, returnUpdate);
          await releaseDriverLive(transaction, driverId);
          return 'returned';
        });

        if (outcome === 'returned') {
          if (driverId) {
            logger.info('[DISPATCH V2] timeout_rejected', {
              rideId,
              driverId,
              redispatchCount,
            });
          }
          logger.info('[REDISPATCH AUTO] returned to admin pool', {
            rideId,
            driverId,
            redispatchCount,
          });
          await notifyAdminsOptional({
            rideId,
            title: 'Course non acceptée ⏱',
            body: 'Une course attribuée est revenue en attente.',
            eventType: 'taxi_ride_auto_redispatch',
          });

          const freshSnap = await db.doc(`rides/${rideId}`).get();
          const freshRide = freshSnap.data();
          if (freshRide) {
            await attemptAutoDispatchForRide(db, rideId, freshRide);
          }
        } else if (outcome === 'expired') {
          logger.info('[REDISPATCH AUTO] ride expired after max attempts', {
            rideId,
            driverId,
            redispatchCount,
            maxAttempts: MAX_AUTO_REDISPATCH,
          });
          await notifyAdminsOptional({
            rideId,
            title: 'Course expirée ⛔',
            body: 'Aucun chauffeur n’a accepté après plusieurs tentatives.',
            eventType: 'taxi_ride_auto_expired',
          });
        }
      } catch (error) {
        logger.error('[REDISPATCH AUTO] transaction failed', {
          rideId,
          error,
        });
      }
    }
  },
);

export { onRideCreatedAutoDispatch } from './autoDispatch';
