import {
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  getRideDocRef,
  getRideRatingDocRef,
  getRideRatingsCollectionRef,
} from '@/firebase/firestore';
import { logger } from '@/services/logger';

export type RideRatingRole = 'client' | 'driver';

export type RideRatingStatus = {
  clientRatedDriver: boolean;
  driverRatedClient: boolean;
};

export type RideRating = {
  id: string;
  rideId: string;
  fromUserId: string;
  fromRole: RideRatingRole;
  toUserId: string;
  toRole: RideRatingRole;
  stars: number;
  comment: string;
  createdAt?: unknown;
};

export type SendRideRatingInput = {
  fromUserId: string;
  fromRole: RideRatingRole;
  toUserId: string;
  toRole: RideRatingRole;
  stars: number;
  comment?: string;
  /** Used for legacy ride.ratedDriverName when client rates driver. */
  toUserName?: string;
};

const MAX_COMMENT_LENGTH = 1000;

export class RideRatingError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RideRatingError';
    this.code = code;
  }
}

function normalizeRideStatus(status: unknown): string {
  const raw = String(status ?? '').trim();
  const lower = raw.toLowerCase();

  if (lower === 'terminée' || lower === 'terminee') return 'Terminée';
  return raw;
}

export function isRideRatingAllowed(status: unknown): boolean {
  return normalizeRideStatus(status) === 'Terminée';
}

export function normalizeRideRatingRole(value: unknown): RideRatingRole {
  return value === 'driver' ? 'driver' : 'client';
}

export function normalizeRideRatingStatus(value: unknown): RideRatingStatus {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    clientRatedDriver: raw.clientRatedDriver === true,
    driverRatedClient: raw.driverRatedClient === true,
  };
}

export function normalizeRideRating(
  id: string,
  raw: Record<string, unknown>,
): RideRating {
  const stars = Number(raw.stars);

  return {
    id,
    rideId: String(raw.rideId ?? ''),
    fromUserId: String(raw.fromUserId ?? ''),
    fromRole: normalizeRideRatingRole(raw.fromRole),
    toUserId: String(raw.toUserId ?? ''),
    toRole: normalizeRideRatingRole(raw.toRole),
    stars: Number.isFinite(stars) ? stars : 0,
    comment: String(raw.comment ?? ''),
    createdAt: raw.createdAt,
  };
}

export function mapRideRatingSnapshot(snapshot: QuerySnapshot): RideRating[] {
  return snapshot.docs.map((docSnap) =>
    normalizeRideRating(docSnap.id, docSnap.data() as Record<string, unknown>),
  );
}

export function buildRideRatingsQuery(rideId: string) {
  return query(getRideRatingsCollectionRef(rideId), orderBy('createdAt', 'asc'));
}

export async function hasRideRating(
  rideId: string,
  fromRole: RideRatingRole,
  fromUserId: string,
): Promise<boolean> {
  const normalizedRideId = rideId.trim();
  const uid = fromUserId.trim();
  if (!normalizedRideId || !uid) {
    return false;
  }

  const snapshot = await getDoc(getRideRatingDocRef(normalizedRideId, fromRole, uid));
  return snapshot.exists();
}

export function subscribeRideRatings(
  rideId: string,
  onRatings: (ratings: RideRating[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const normalizedRideId = rideId.trim();
  if (!normalizedRideId) {
    throw new RideRatingError('ride_id_required', 'rideId is required to subscribe to ratings.');
  }

  return onSnapshot(
    buildRideRatingsQuery(normalizedRideId),
    (snapshot) => {
      onRatings(mapRideRatingSnapshot(snapshot));
    },
    (error) => {
      logger.error('[RIDE RATING] subscribeRideRatings failed', { rideId: normalizedRideId, error });
      onError?.(error);
    },
  );
}

function readStars(value: unknown): number {
  const stars = Number(value);
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    throw new RideRatingError('invalid_stars', 'La note doit être entre 1 et 5.');
  }
  return Math.round(stars);
}

function buildLegacyRideRatingPatch(
  input: SendRideRatingInput,
  stars: number,
  ride: Record<string, unknown>,
): Record<string, unknown> | null {
  if (input.fromRole !== 'client' || input.toRole !== 'driver') {
    return null;
  }

  if (ride.rating != null && Number(ride.rating) >= 1) {
    return null;
  }

  return {
    rating: stars,
    comment: String(input.comment ?? '').trim(),
    ratedAt: serverTimestamp(),
    ratedDriverId: input.toUserId,
    ratedDriverName: String(
      input.toUserName ?? ride.driverName ?? 'Chauffeur PROTAXI',
    ),
    clientPoints: stars * 10,
  };
}

export async function sendRideRating(
  rideId: string,
  input: SendRideRatingInput,
): Promise<string> {
  const normalizedRideId = rideId.trim();
  const fromUserId = input.fromUserId.trim();
  const toUserId = input.toUserId.trim();
  const fromRole = normalizeRideRatingRole(input.fromRole);
  const toRole = normalizeRideRatingRole(input.toRole);
  const stars = readStars(input.stars);
  const comment = String(input.comment ?? '').trim();

  if (!normalizedRideId) {
    throw new RideRatingError('ride_id_required', 'rideId is required.');
  }
  if (!fromUserId) {
    throw new RideRatingError('sender_required', 'fromUserId is required.');
  }
  if (!toUserId) {
    throw new RideRatingError('recipient_required', 'toUserId is required.');
  }
  if (fromRole === toRole) {
    throw new RideRatingError('invalid_roles', 'fromRole and toRole must differ.');
  }
  if (comment.length > MAX_COMMENT_LENGTH) {
    throw new RideRatingError(
      'comment_too_long',
      `Le commentaire dépasse ${MAX_COMMENT_LENGTH} caractères.`,
    );
  }

  try {
    const ratingDocId = await runTransaction(db, async (transaction) => {
      const rideRef = getRideDocRef(normalizedRideId);
      const ratingRef = getRideRatingDocRef(normalizedRideId, fromRole, fromUserId);

      const rideSnap = await transaction.get(rideRef);
      const existingRatingSnap = await transaction.get(ratingRef);

      if (!rideSnap.exists()) {
        throw new RideRatingError('ride_not_found', 'Course introuvable.');
      }

      if (existingRatingSnap.exists()) {
        throw new RideRatingError('already_rated', 'Vous avez déjà noté cette course.');
      }

      const ride = rideSnap.data() as Record<string, unknown>;
      const status = normalizeRideStatus(ride.status);

      if (!isRideRatingAllowed(status)) {
        throw new RideRatingError(
          'rating_not_allowed',
          'Les notes ne sont possibles que pour une course terminée.',
        );
      }

      const rideClientUid = String(ride.clientUid ?? '').trim();
      const rideDriverId = String(ride.driverId ?? '').trim();

      if (fromRole === 'client') {
        if (rideClientUid !== fromUserId) {
          throw new RideRatingError('not_ride_client', 'Seul le client peut envoyer cette note.');
        }
        if (toUserId !== rideDriverId) {
          throw new RideRatingError('invalid_driver', 'Chauffeur cible invalide.');
        }
      }

      if (fromRole === 'driver') {
        if (rideDriverId !== fromUserId) {
          throw new RideRatingError('not_ride_driver', 'Seul le chauffeur assigné peut noter le client.');
        }
        if (toUserId !== rideClientUid) {
          throw new RideRatingError('invalid_client', 'Client cible invalide.');
        }
      }

      transaction.set(ratingRef, {
        rideId: normalizedRideId,
        fromUserId,
        fromRole,
        toUserId,
        toRole,
        stars,
        comment,
        createdAt: serverTimestamp(),
      });

      const currentStatus = normalizeRideRatingStatus(ride.ratingStatus);
      const ratingStatus: RideRatingStatus = {
        clientRatedDriver:
          currentStatus.clientRatedDriver || (fromRole === 'client' && toRole === 'driver'),
        driverRatedClient:
          currentStatus.driverRatedClient || (fromRole === 'driver' && toRole === 'client'),
      };

      const rideUpdate: Record<string, unknown> = {
        ratingStatus,
        updatedAt: serverTimestamp(),
      };

      const legacyPatch = buildLegacyRideRatingPatch(input, stars, ride);
      if (legacyPatch) {
        Object.assign(rideUpdate, legacyPatch);
      }

      if (fromRole === 'driver' && toRole === 'client') {
        rideUpdate.clientRating = stars;
      }

      transaction.update(rideRef, rideUpdate);

      return ratingRef.id;
    });

    logger.info('[RIDE RATING] rating sent', {
      rideId: normalizedRideId,
      ratingDocId,
      fromRole,
      toRole,
      stars,
    });

    return ratingDocId;
  } catch (error) {
    if (error instanceof RideRatingError) {
      throw error;
    }

    logger.error('[RIDE RATING] sendRideRating failed', {
      rideId: normalizedRideId,
      fromRole,
      error,
    });
    throw error;
  }
}

export function readLegacyClientStars(ride: Record<string, unknown> | null | undefined): number | null {
  if (!ride) return null;
  const stars = Number(ride.rating);
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return null;
  }
  return Math.round(stars);
}

export function clientHasRatedDriverFromRide(
  ride: Record<string, unknown> | null | undefined,
): boolean {
  if (!ride) return false;
  const status = normalizeRideRatingStatus(ride.ratingStatus);
  if (status.clientRatedDriver) return true;
  return readLegacyClientStars(ride) != null;
}

export function driverHasRatedClientFromRide(
  ride: Record<string, unknown> | null | undefined,
): boolean {
  if (!ride) return false;
  if (normalizeRideRatingStatus(ride.ratingStatus).driverRatedClient) {
    return true;
  }
  const clientRating = Number(ride.clientRating);
  return Number.isFinite(clientRating) && clientRating >= 1 && clientRating <= 5;
}

export function canClientRateDriverFromRide(
  ride: Record<string, unknown> | null | undefined,
): boolean {
  if (!ride || !isRideRatingAllowed(ride.status)) return false;
  return !clientHasRatedDriverFromRide(ride);
}

export function canDriverRateClientFromRide(
  ride: Record<string, unknown> | null | undefined,
): boolean {
  if (!ride || !isRideRatingAllowed(ride.status)) return false;
  return !driverHasRatedClientFromRide(ride);
}

export function getClientDisplayRating(
  ride: Record<string, unknown> | null | undefined,
): number | null {
  if (!ride) return null;
  const status = normalizeRideRatingStatus(ride.ratingStatus);
  const clientRating = Number(ride.clientRating);
  if (status.driverRatedClient && Number.isFinite(clientRating) && clientRating >= 1) {
    return Math.round(clientRating);
  }
  return null;
}

export async function resolveClientHasRatedDriver(
  rideId: string,
  clientUid: string,
  ride?: Record<string, unknown> | null,
): Promise<boolean> {
  if (clientHasRatedDriverFromRide(ride ?? null)) {
    return true;
  }
  return hasRideRating(rideId, 'client', clientUid);
}

export async function resolveDriverHasRatedClient(
  rideId: string,
  driverUid: string,
  ride?: Record<string, unknown> | null,
): Promise<boolean> {
  if (driverHasRatedClientFromRide(ride ?? null)) {
    return true;
  }
  return hasRideRating(rideId, 'driver', driverUid);
}
