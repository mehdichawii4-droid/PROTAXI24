import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';

type DriverAvailability = 'offline' | 'available' | 'pending_accept' | 'busy';

type DriversLiveDoc = {
  id?: string;
  driverId?: string;
  isOnline?: boolean;
  isBusy?: boolean;
  availability?: DriverAvailability;
  currentRideId?: string;
  latitude?: number;
  longitude?: number;
  locationUpdatedAt?: admin.firestore.Timestamp | Date | string | number;
  updatedAt?: admin.firestore.Timestamp | Date | string | number;
  driverName?: string;
  name?: string;
  driverPhone?: string;
  phone?: string;
  photo?: string;
  plate?: string;
  car?: string;
};

type DriversProfileDoc = {
  isApproved?: boolean;
  isSuspended?: boolean;
};

type AssignNearestDriverCandidate = DriversLiveDoc & {
  id: string;
};

type AssignRideInput = {
  rideId: string;
  driverId: string;
  driverLiveDocId: string;
  driverName: string;
  driverPhone: string;
  driverPhoto: string;
  driverPlate: string;
  driverCar: string;
};

const DEFAULT_GUELMA = { latitude: 36.462, longitude: 7.426 };
/** GPS older than this is excluded from auto-dispatch (3 min). */
const GPS_STALE_MS = 180_000;
/** Adds up to ~3 km equivalent penalty as GPS ages toward stale threshold. */
const GPS_FRESHNESS_PENALTY_PER_SEC = 1;

class AutoDispatchError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AutoDispatchError';
    this.code = code;
  }
}

function normalizeRideStatus(status: unknown): string {
  const raw = String(status ?? '').trim();
  const lower = raw.toLowerCase();

  if (lower === 'en attente') return 'En attente';
  if (lower === 'attribuée' || lower === 'attribuee') return 'Attribuée';
  if (lower === 'acceptée' || lower === 'acceptee') return 'Acceptée';
  if (lower === 'en route') return 'En route';
  if (lower === 'arrivé' || lower === 'arrive') return 'Arrivé';
  if (lower === 'terminée' || lower === 'terminee') return 'Terminée';
  if (lower === 'refusée' || lower === 'refusee') return 'Refusée';
  if (lower === 'expirée' || lower === 'expiree') return 'Expirée';
  if (lower === 'annulée' || lower === 'annulee') return 'Annulée';

  return raw || 'Inconnue';
}

function hasAssignedDriverId(driverId: unknown): boolean {
  return String(driverId || '').trim().length > 0;
}

type DispatchRejectReason =
  | 'unregistered'
  | 'timeout_rejected'
  | 'offline'
  | 'busy'
  | 'availability'
  | 'current_ride'
  | 'profile_missing'
  | 'not_approved'
  | 'suspended'
  | 'missing_coordinates'
  | 'stale_gps';

function readLocationTimestampMs(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof admin.firestore.Timestamp) {
    return value.toMillis();
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isFinite(date.getTime()) ? date.getTime() : null;
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getTime() : null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function getDriverLocationUpdatedAtMs(liveDriver: DriversLiveDoc): number {
  const candidates = [liveDriver.locationUpdatedAt, liveDriver.updatedAt];
  for (const value of candidates) {
    const ms = readLocationTimestampMs(value);
    if (ms != null) return ms;
  }
  return 0;
}

function getGpsAgeMs(liveDriver: DriversLiveDoc, nowMs: number): number {
  const updatedAtMs = getDriverLocationUpdatedAtMs(liveDriver);
  if (updatedAtMs <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, nowMs - updatedAtMs);
}

function isGpsStale(liveDriver: DriversLiveDoc, nowMs: number): boolean {
  return getGpsAgeMs(liveDriver, nowMs) > GPS_STALE_MS;
}

function hasValidCoordinates(liveDriver: DriversLiveDoc): boolean {
  const lat = Number(liveDriver.latitude);
  const lng = Number(liveDriver.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function getDispatchRejectReason(
  candidate: AssignNearestDriverCandidate,
  driverId: string,
  profile: DriversProfileDoc | undefined,
  rejectedSet: Set<string>,
  nowMs: number,
): DispatchRejectReason | null {
  if (!driverId) return 'unregistered';
  if (rejectedSet.has(driverId)) return 'timeout_rejected';
  if (!candidate.isOnline) return 'offline';
  if (candidate.isBusy) return 'busy';

  const availability = candidate.availability;
  if (availability && availability !== 'available') return 'availability';
  if (String(candidate.currentRideId || '').trim()) return 'current_ride';
  if (!profile) return 'profile_missing';
  if (profile.isApproved === false) return 'not_approved';
  if (profile.isSuspended === true) return 'suspended';
  if (!hasValidCoordinates(candidate)) return 'missing_coordinates';
  if (isGpsStale(candidate, nowMs)) return 'stale_gps';

  return null;
}

function computeDispatchScoreV2(
  rideCoords: { latitude: number; longitude: number },
  candidate: AssignNearestDriverCandidate,
  nowMs: number,
): { score: number; distanceM: number; gpsAgeMs: number } {
  const distanceM = haversineDistanceMeters(rideCoords, {
    latitude: Number(candidate.latitude),
    longitude: Number(candidate.longitude),
  });
  const gpsAgeMs = getGpsAgeMs(candidate, nowMs);
  const freshnessPenaltyM =
    Number.isFinite(gpsAgeMs) && gpsAgeMs < Number.POSITIVE_INFINITY
      ? (gpsAgeMs / 1000) * GPS_FRESHNESS_PENALTY_PER_SEC
      : 0;

  return {
    score: distanceM + freshnessPenaltyM,
    distanceM,
    gpsAgeMs: Number.isFinite(gpsAgeMs) ? gpsAgeMs : -1,
  };
}

function isLiveDriverAvailable(liveData: Record<string, unknown> | undefined): boolean {
  if (!liveData?.isOnline) return false;
  if (liveData.isBusy) return false;

  const availability = liveData.availability as DriverAvailability | undefined;
  if (availability && availability !== 'available') return false;

  return !String(liveData.currentRideId || '').trim();
}

function assertDriverProfileEligible(profile: Record<string, unknown> | undefined) {
  if (!profile) return;

  if (profile.isApproved === false) {
    throw new AutoDispatchError('driver_not_approved', 'Chauffeur non approuvé.');
  }

  if (profile.isSuspended === true) {
    throw new AutoDispatchError('driver_suspended', 'Chauffeur suspendu.');
  }
}

function resolveRegisteredDriverId(
  candidate: AssignNearestDriverCandidate,
  profileByDriverId: Map<string, DriversProfileDoc>,
): string {
  const fieldDriverId = String(candidate.driverId || '').trim();
  const liveDocId = String(candidate.id || '');

  if (fieldDriverId && profileByDriverId.has(fieldDriverId)) {
    return fieldDriverId;
  }

  if (liveDocId && profileByDriverId.has(liveDocId)) {
    return liveDocId;
  }

  return '';
}

function haversineDistanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const earthRadiusM = 6371000;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLng = ((to.longitude - from.longitude) * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusM * Math.asin(Math.sqrt(h));
}

function getRideCoordinates(ride: Record<string, unknown>) {
  return {
    latitude: Number(ride.latitude ?? ride.clientLatitude ?? DEFAULT_GUELMA.latitude),
    longitude: Number(ride.longitude ?? ride.clientLongitude ?? DEFAULT_GUELMA.longitude),
  };
}

async function assignRideToDriverAdmin(
  db: admin.firestore.Firestore,
  input: AssignRideInput,
): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const rideRef = db.doc(`rides/${input.rideId}`);
    const liveRef = db.doc(`driversLive/${input.driverLiveDocId}`);
    const profileRef = db.doc(`drivers/${input.driverId}`);

    const rideSnap = await transaction.get(rideRef);
    const liveSnap = await transaction.get(liveRef);
    const profileSnap = await transaction.get(profileRef);

    if (!rideSnap.exists) {
      throw new AutoDispatchError('ride_not_found', 'Course introuvable.');
    }

    const ride = rideSnap.data() as Record<string, unknown>;
    const status = normalizeRideStatus(ride.status);
    const rejectedDriverIds = Array.isArray(ride.rejectedDriverIds)
      ? ride.rejectedDriverIds.map(String)
      : [];

    if (rejectedDriverIds.includes(input.driverId)) {
      throw new AutoDispatchError(
        'driver_already_rejected',
        'Ce chauffeur a déjà refusé cette course.',
      );
    }

    if (hasAssignedDriverId(ride.driverId)) {
      throw new AutoDispatchError('ride_already_assigned', 'Cette course possède déjà un chauffeur.');
    }

    if (status !== 'En attente') {
      throw new AutoDispatchError(
        'ride_not_available',
        `Impossible d'attribuer une course au statut ${status}.`,
      );
    }

    const liveData = liveSnap.data() as Record<string, unknown> | undefined;
    if (!isLiveDriverAvailable(liveData)) {
      throw new AutoDispatchError('driver_not_available', 'Ce chauffeur est indisponible.');
    }

    const liveDriver = (liveData ?? {}) as DriversLiveDoc;
    if (!hasValidCoordinates(liveDriver)) {
      throw new AutoDispatchError('driver_stale_gps', 'Position chauffeur indisponible.');
    }
    if (isGpsStale(liveDriver, Date.now())) {
      throw new AutoDispatchError('driver_stale_gps', 'Position GPS trop ancienne.');
    }

    if (profileSnap.exists) {
      assertDriverProfileEligible(profileSnap.data() as Record<string, unknown>);
    }

    const dispatchAttempt = Number(ride.dispatchAttempt || 0) + 1;
    const updatedAt = admin.firestore.FieldValue.serverTimestamp();

    transaction.update(rideRef, {
      status: 'Attribuée',
      driverId: input.driverId,
      driverName: input.driverName,
      driverPhone: input.driverPhone,
      driverPhoto: input.driverPhoto,
      driverPlate: input.driverPlate,
      driverCar: input.driverCar,
      assignedAt: updatedAt,
      dispatchAttempt,
      updatedAt,
    });

    transaction.set(
      liveRef,
      {
        driverId: input.driverId,
        driverName: input.driverName,
        isBusy: true,
        currentRideId: input.rideId,
        availability: 'pending_accept',
        updatedAt,
      },
      { merge: true },
    );
  });
}

async function loadDispatchContext(db: admin.firestore.Firestore): Promise<{
  candidates: AssignNearestDriverCandidate[];
  profileByDriverId: Map<string, DriversProfileDoc>;
}> {
  const [liveSnap, driversSnap] = await Promise.all([
    db.collection('driversLive').get(),
    db.collection('drivers').get(),
  ]);

  const profileByDriverId = new Map<string, DriversProfileDoc>();
  driversSnap.forEach((docSnap) => {
    const data = docSnap.data();
    profileByDriverId.set(docSnap.id, {
      isApproved: data.isApproved !== false,
      isSuspended: data.isSuspended === true,
    });
  });

  const candidates = liveSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as DriversLiveDoc),
  }));

  return { candidates, profileByDriverId };
}

async function autoDispatchNearestEligibleDriver(params: {
  db: admin.firestore.Firestore;
  rideId: string;
  ride: Record<string, unknown>;
}): Promise<{ driverId: string; driverName: string; distanceM: number; score: number; gpsAgeMs: number }> {
  const rideCoords = getRideCoordinates(params.ride);
  const rejectedDriverIds = Array.isArray(params.ride.rejectedDriverIds)
    ? params.ride.rejectedDriverIds.map(String)
    : [];
  const nowMs = Date.now();

  const { candidates, profileByDriverId } = await loadDispatchContext(params.db);
  const rejectedSet = new Set(rejectedDriverIds);

  const scoredCandidates: Array<{
    candidate: AssignNearestDriverCandidate;
    driverId: string;
    score: number;
    distanceM: number;
    gpsAgeMs: number;
  }> = [];

  for (const candidate of candidates) {
    const driverId = resolveRegisteredDriverId(candidate, profileByDriverId);
    const profile = driverId ? profileByDriverId.get(driverId) : undefined;
    const rejectReason = getDispatchRejectReason(
      candidate,
      driverId,
      profile,
      rejectedSet,
      nowMs,
    );

    if (rejectReason) {
      if (driverId) {
        logger.info('[DISPATCH V2] candidate rejected', {
          rideId: params.rideId,
          driverId,
          reason: rejectReason,
        });
      }
      continue;
    }

    const { score, distanceM, gpsAgeMs } = computeDispatchScoreV2(rideCoords, candidate, nowMs);
    scoredCandidates.push({
      candidate,
      driverId,
      score,
      distanceM,
      gpsAgeMs,
    });
  }

  if (scoredCandidates.length === 0) {
    logger.info('[DISPATCH V2] no_eligible_candidates', {
      rideId: params.rideId,
      totalLive: candidates.length,
      rejectedCount: rejectedSet.size,
    });
    throw new AutoDispatchError('no_driver', 'Aucun chauffeur disponible.');
  }

  logger.info('[DISPATCH V2] candidates', {
    rideId: params.rideId,
    eligible: scoredCandidates.length,
    totalLive: candidates.length,
    rejectedCount: rejectedSet.size,
  });

  const sortedCandidates = [...scoredCandidates].sort((left, right) => left.score - right.score);

  let lastError: AutoDispatchError | null = null;
  const retryableCodes = [
    'driver_not_available',
    'driver_not_approved',
    'driver_suspended',
    'driver_already_rejected',
    'driver_stale_gps',
  ];

  for (const entry of sortedCandidates) {
    const { candidate, driverId, distanceM, score, gpsAgeMs } = entry;
    const driverName = candidate.driverName || candidate.name || 'Chauffeur PROTAXI';

    try {
      await assignRideToDriverAdmin(params.db, {
        rideId: params.rideId,
        driverId,
        driverLiveDocId: candidate.id,
        driverName,
        driverPhone: candidate.driverPhone || candidate.phone || '',
        driverPhoto: candidate.photo || 'https://i.imgur.com/6VBx3io.png',
        driverPlate: candidate.plate || '24-000-16',
        driverCar: candidate.car || 'Renault Clio • Berline',
      });

      logger.info('[DISPATCH V2] selected driver', {
        rideId: params.rideId,
        driverId,
        driverName,
        score: Math.round(score),
        distanceM: Math.round(distanceM),
        gpsAgeMs: Math.round(gpsAgeMs),
      });

      return { driverId, driverName, distanceM, score, gpsAgeMs };
    } catch (error) {
      if (error instanceof AutoDispatchError && retryableCodes.includes(error.code)) {
        logger.info('[DISPATCH V2] candidate skipped', {
          rideId: params.rideId,
          driverId,
          code: error.code,
        });
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new AutoDispatchError('no_driver', 'Aucun chauffeur disponible.');
}

export async function attemptAutoDispatchForRide(
  db: admin.firestore.Firestore,
  rideId: string,
  ride: Record<string, unknown>,
): Promise<void> {
  const status = normalizeRideStatus(ride.status);
  const rideMode = String(ride.rideMode || '').trim();

  if (status !== 'En attente') {
    logger.info('[DISPATCH V2] skip — status not En attente', { rideId, status });
    return;
  }

  if (rideMode !== 'Maintenant') {
    logger.info('[DISPATCH V2] skip — rideMode not Maintenant', { rideId, rideMode });
    return;
  }

  if (hasAssignedDriverId(ride.driverId)) {
    logger.info('[DISPATCH V2] skip — driver already assigned', { rideId });
    return;
  }

  const rideCoords = getRideCoordinates(ride);
  logger.info('[DISPATCH V2] start', {
    rideId,
    latitude: rideCoords.latitude,
    longitude: rideCoords.longitude,
    gpsStaleMs: GPS_STALE_MS,
  });

  try {
    await autoDispatchNearestEligibleDriver({ db, rideId, ride });
  } catch (error) {
    if (error instanceof AutoDispatchError) {
      if (error.code === 'no_driver') {
        logger.info('[DISPATCH V2] no driver — ride stays En attente', { rideId });
        return;
      }

      if (error.code === 'ride_already_assigned') {
        logger.info('[DISPATCH V2] already assigned — skip', { rideId });
        return;
      }

      if (error.code === 'driver_not_available') {
        logger.info('[DISPATCH V2] driver not available — ride stays En attente', {
          rideId,
          code: error.code,
        });
        return;
      }
    }

    logger.error('[DISPATCH V2] failed', { rideId, error });
  }
}

export const onRideCreatedAutoDispatch = onDocumentCreated(
  {
    document: 'rides/{rideId}',
    region: 'europe-west1',
  },
  async (event) => {
    const rideId = event.params.rideId;
    const ride = event.data?.data() as Record<string, unknown> | undefined;

    if (!ride) {
      logger.info('[DISPATCH V2] skip — missing ride data', { rideId });
      return;
    }

    const db = admin.firestore();
    await attemptAutoDispatchForRide(db, rideId, ride);
  },
);
