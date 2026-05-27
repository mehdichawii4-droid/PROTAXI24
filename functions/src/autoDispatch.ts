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

function isDriverEligibleForDispatch(
  liveDriver: DriversLiveDoc,
  profile?: DriversProfileDoc | null,
): boolean {
  if (!liveDriver.isOnline) return false;
  if (liveDriver.isBusy) return false;

  const availability = liveDriver.availability;
  if (availability && availability !== 'available') return false;
  if (String(liveDriver.currentRideId || '').trim()) return false;
  if (!profile) return false;
  if (profile.isApproved === false) return false;
  if (profile.isSuspended === true) return false;

  return true;
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
}): Promise<{ driverId: string; driverName: string; distanceM: number }> {
  const rideCoords = getRideCoordinates(params.ride);
  const rejectedDriverIds = Array.isArray(params.ride.rejectedDriverIds)
    ? params.ride.rejectedDriverIds.map(String)
    : [];

  const { candidates, profileByDriverId } = await loadDispatchContext(params.db);
  const rejectedSet = new Set(rejectedDriverIds);

  const eligibleCandidates = candidates.filter((candidate) => {
    const driverId = resolveRegisteredDriverId(candidate, profileByDriverId);
    if (!driverId) return false;
    if (rejectedSet.has(driverId)) return false;
    const profile = profileByDriverId.get(driverId);
    return isDriverEligibleForDispatch(candidate, profile);
  });

  if (eligibleCandidates.length === 0) {
    throw new AutoDispatchError('no_driver', 'Aucun chauffeur disponible.');
  }

  logger.info('[AUTO DISPATCH] candidates', {
    rideId: params.rideId,
    eligible: eligibleCandidates.length,
    totalLive: candidates.length,
  });

  const sortedCandidates = [...eligibleCandidates].sort((left, right) => {
    const distanceA = haversineDistanceMeters(rideCoords, {
      latitude: left.latitude ?? DEFAULT_GUELMA.latitude,
      longitude: left.longitude ?? DEFAULT_GUELMA.longitude,
    });
    const distanceB = haversineDistanceMeters(rideCoords, {
      latitude: right.latitude ?? DEFAULT_GUELMA.latitude,
      longitude: right.longitude ?? DEFAULT_GUELMA.longitude,
    });

    return distanceA - distanceB;
  });

  let lastError: AutoDispatchError | null = null;

  for (const candidate of sortedCandidates) {
    const driverId = resolveRegisteredDriverId(candidate, profileByDriverId);
    if (!driverId) continue;

    const driverName = candidate.driverName || candidate.name || 'Chauffeur PROTAXI';
    const distanceM = haversineDistanceMeters(rideCoords, {
      latitude: candidate.latitude ?? DEFAULT_GUELMA.latitude,
      longitude: candidate.longitude ?? DEFAULT_GUELMA.longitude,
    });

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

      return { driverId, driverName, distanceM };
    } catch (error) {
      if (
        error instanceof AutoDispatchError
        && ['driver_not_available', 'driver_not_approved', 'driver_suspended', 'driver_already_rejected'].includes(
          error.code,
        )
      ) {
        logger.info('[AUTO DISPATCH] candidate skipped', {
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

export const onRideCreatedAutoDispatch = onDocumentCreated(
  {
    document: 'rides/{rideId}',
    region: 'europe-west1',
  },
  async (event) => {
    const rideId = event.params.rideId;
    const ride = event.data?.data() as Record<string, unknown> | undefined;

    if (!ride) {
      logger.info('[AUTO DISPATCH] skip — missing ride data', { rideId });
      return;
    }

    const status = normalizeRideStatus(ride.status);
    const rideMode = String(ride.rideMode || '').trim();

    if (status !== 'En attente') {
      logger.info('[AUTO DISPATCH] skip — status not En attente', { rideId, status });
      return;
    }

    if (rideMode !== 'Maintenant') {
      logger.info('[AUTO DISPATCH] skip — rideMode not Maintenant', { rideId, rideMode });
      return;
    }

    if (hasAssignedDriverId(ride.driverId)) {
      logger.info('[AUTO DISPATCH] skip — driver already assigned', { rideId });
      return;
    }

    const rideCoords = getRideCoordinates(ride);
    logger.info('[AUTO DISPATCH] start', {
      rideId,
      latitude: rideCoords.latitude,
      longitude: rideCoords.longitude,
    });

    try {
      const db = admin.firestore();
      const result = await autoDispatchNearestEligibleDriver({ db, rideId, ride });

      logger.info('[AUTO DISPATCH] assigned', {
        rideId,
        driverId: result.driverId,
        driverName: result.driverName,
        distanceM: Math.round(result.distanceM),
      });
    } catch (error) {
      if (error instanceof AutoDispatchError) {
        if (error.code === 'no_driver') {
          logger.info('[AUTO DISPATCH] no driver — ride stays En attente', { rideId });
          return;
        }

        if (error.code === 'ride_already_assigned') {
          logger.info('[AUTO DISPATCH] already assigned — skip', { rideId });
          return;
        }

        if (error.code === 'driver_not_available') {
          logger.info('[AUTO DISPATCH] driver not available — ride stays En attente', {
            rideId,
            code: error.code,
          });
          return;
        }
      }

      logger.error('[AUTO DISPATCH] failed', { rideId, error });
    }
  },
);
