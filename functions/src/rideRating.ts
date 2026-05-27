import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';

type RideRatingRole = 'client' | 'driver';

type RideRatingDoc = {
  rideId?: string;
  fromUserId?: string;
  fromRole?: RideRatingRole;
  toUserId?: string;
  toRole?: RideRatingRole;
  stars?: number;
  comment?: string;
};

function readStars(value: unknown): number | null {
  const stars = Number(value);
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return null;
  }
  return Math.round(stars);
}

function buildAggregateId(rideId: string, fromUserId: string, fromRole: string): string {
  return `${rideId}_${fromUserId}_${fromRole}`;
}

async function aggregateDriverRating(params: {
  rideId: string;
  driverId: string;
  stars: number;
  comment: string;
  aggregateId: string;
}): Promise<void> {
  const db = admin.firestore();
  const driverLiveRef = db.doc(`driversLive/${params.driverId}`);
  const driverProfileRef = db.doc(`drivers/${params.driverId}`);

  await db.runTransaction(async (transaction) => {
    const driverLiveSnap = await transaction.get(driverLiveRef);

    if (
      driverLiveSnap.exists
      && driverLiveSnap.data()?.lastAggregatedRatingId === params.aggregateId
    ) {
      logger.info('[RATING FN] skip driver aggregate — already applied', {
        rideId: params.rideId,
        driverId: params.driverId,
        aggregateId: params.aggregateId,
      });
      return;
    }

    const oldCount = driverLiveSnap.exists
      ? Number(driverLiveSnap.data()?.ratingsCount || 0)
      : 0;
    const oldTotal = driverLiveSnap.exists
      ? Number(driverLiveSnap.data()?.ratingsTotal || 0)
      : 0;

    const newCount = oldCount + 1;
    const newTotal = oldTotal + params.stars;
    const averageRating = newTotal / newCount;
    const updatedAt = admin.firestore.FieldValue.serverTimestamp();

    transaction.set(
      driverLiveRef,
      {
        ratingsCount: newCount,
        ratingsTotal: newTotal,
        averageRating,
        lastRating: params.stars,
        lastComment: params.comment,
        lastRatingRideId: params.rideId,
        lastAggregatedRatingId: params.aggregateId,
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

  logger.info('[RATING FN] driver aggregate updated', {
    rideId: params.rideId,
    driverId: params.driverId,
    stars: params.stars,
    aggregateId: params.aggregateId,
  });
}

async function aggregateClientRating(params: {
  rideId: string;
  clientUid: string;
  stars: number;
  comment: string;
  aggregateId: string;
}): Promise<void> {
  const db = admin.firestore();
  const userRef = db.doc(`users/${params.clientUid}`);

  await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);

    if (!userSnap.exists) {
      logger.warn('[RATING FN] skip client aggregate — user profile missing', {
        rideId: params.rideId,
        clientUid: params.clientUid,
      });
      return;
    }

    if (userSnap.data()?.lastAggregatedRatingId === params.aggregateId) {
      logger.info('[RATING FN] skip client aggregate — already applied', {
        rideId: params.rideId,
        clientUid: params.clientUid,
        aggregateId: params.aggregateId,
      });
      return;
    }

    const oldCount = Number(userSnap.data()?.clientRatingCount || 0);
    const oldTotal = Number(userSnap.data()?.clientRatingTotal || 0);
    const newCount = oldCount + 1;
    const newTotal = oldTotal + params.stars;
    const clientRatingAverage = newTotal / newCount;
    const updatedAt = admin.firestore.FieldValue.serverTimestamp();

    transaction.set(
      userRef,
      {
        clientRatingAverage,
        clientRatingCount: newCount,
        clientRatingTotal: newTotal,
        lastClientRating: params.stars,
        lastClientRatingComment: params.comment,
        lastAggregatedRatingId: params.aggregateId,
        updatedAt,
      },
      { merge: true },
    );
  });

  logger.info('[RATING FN] client aggregate updated', {
    rideId: params.rideId,
    clientUid: params.clientUid,
    stars: params.stars,
    aggregateId: params.aggregateId,
  });
}

export const onRideRatingCreated = onDocumentCreated(
  {
    document: 'rides/{rideId}/ratings/{ratingId}',
    region: 'europe-west1',
  },
  async (event) => {
    const rideId = event.params.rideId;
    const ratingId = event.params.ratingId;
    const data = event.data?.data() as RideRatingDoc | undefined;

    if (!data) {
      logger.info('[RATING FN] skip — missing rating data', { rideId, ratingId });
      return;
    }

    const stars = readStars(data.stars);
    if (stars == null) {
      logger.warn('[RATING FN] skip — invalid stars', { rideId, ratingId, stars: data.stars });
      return;
    }

    const fromUserId = String(data.fromUserId ?? '').trim();
    const fromRole = String(data.fromRole ?? '').trim();
    const toUserId = String(data.toUserId ?? '').trim();
    const toRole = String(data.toRole ?? '').trim();
    const comment = String(data.comment ?? '').trim();

    if (!fromUserId || !toUserId || !fromRole || !toRole) {
      logger.warn('[RATING FN] skip — missing rating fields', {
        rideId,
        ratingId,
        fromUserId,
        toUserId,
        fromRole,
        toRole,
      });
      return;
    }

    const aggregateId = buildAggregateId(rideId, fromUserId, fromRole);

    logger.info('[RATING FN] rating created', {
      rideId,
      ratingId,
      fromRole,
      toRole,
      stars,
      aggregateId,
    });

    try {
      if (toRole === 'driver') {
        await aggregateDriverRating({
          rideId,
          driverId: toUserId,
          stars,
          comment,
          aggregateId,
        });
        return;
      }

      if (toRole === 'client') {
        await aggregateClientRating({
          rideId,
          clientUid: toUserId,
          stars,
          comment,
          aggregateId,
        });
      }
    } catch (error) {
      logger.error('[RATING FN] aggregate failed', {
        rideId,
        ratingId,
        fromRole,
        toRole,
        error,
      });
      throw error;
    }
  },
);
