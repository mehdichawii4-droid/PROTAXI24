import {
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import {
  hasAssignedDriverId,
  normalizeRideStatus,
  type DriverAvailability,
} from '@/types/driver';
import { devError, devLog } from '@/utils/devLog';

export class DriverDispatchError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DriverDispatchError';
    this.code = code;
  }
}

export type DriversLiveDoc = {
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

export type DriversProfileDoc = {
  isApproved?: boolean;
  isSuspended?: boolean;
};

export function isDriverEligibleForDispatch(
  liveDriver: DriversLiveDoc,
  profile?: DriversProfileDoc | null,
): boolean {
  if (!liveDriver.isOnline) {
    return false;
  }

  if (liveDriver.isBusy) {
    return false;
  }

  const availability = liveDriver.availability;
  if (availability && availability !== 'available') {
    return false;
  }

  if (String(liveDriver.currentRideId || '').trim()) {
    return false;
  }

  if (!profile) {
    return false;
  }

  if (profile.isApproved === false) {
    return false;
  }

  if (profile.isSuspended === true) {
    return false;
  }

  return true;
}

function isLiveDriverAvailable(liveData: Record<string, unknown> | undefined): boolean {
  if (!liveData?.isOnline) {
    return false;
  }

  if (liveData.isBusy) {
    return false;
  }

  const availability = liveData.availability as DriverAvailability | undefined;
  if (availability && availability !== 'available') {
    return false;
  }

  return !String(liveData.currentRideId || '').trim();
}

function assertDriverProfileEligible(profile: Record<string, unknown> | undefined) {
  if (!profile) {
    return;
  }

  if (profile.isApproved === false) {
    throw new DriverDispatchError('driver_not_approved', 'Chauffeur non approuvé.');
  }

  if (profile.isSuspended === true) {
    throw new DriverDispatchError('driver_suspended', 'Chauffeur suspendu.');
  }
}

export type AssignRideInput = {
  rideId: string;
  driverId: string;
  driverLiveDocId: string;
  driverName: string;
  driverPhone: string;
  driverPhoto: string;
  driverPlate: string;
  driverCar: string;
};

export async function assignRideToDriver(input: AssignRideInput): Promise<void> {
  devLog('[DISPATCH] assign attempt', {
    rideId: input.rideId,
    driverId: input.driverId,
    driverLiveDocId: input.driverLiveDocId,
  });

  try {
    await runTransaction(db, async (transaction) => {
      const rideRef = doc(db, 'rides', input.rideId);
      const liveRef = doc(db, 'driversLive', input.driverLiveDocId);
      const profileRef = doc(db, 'drivers', input.driverId);

      const rideSnap = await transaction.get(rideRef);
      const liveSnap = await transaction.get(liveRef);
      const profileSnap = await transaction.get(profileRef);

      if (!rideSnap.exists()) {
        throw new DriverDispatchError('ride_not_found', 'Course introuvable.');
      }

      const ride = rideSnap.data() as Record<string, unknown>;
      const status = normalizeRideStatus(String(ride.status || ''));
      const rejectedDriverIds = Array.isArray(ride.rejectedDriverIds)
        ? ride.rejectedDriverIds.map(String)
        : [];

      if (rejectedDriverIds.includes(input.driverId)) {
        throw new DriverDispatchError(
          'driver_already_rejected',
          'Ce chauffeur a déjà refusé cette course.',
        );
      }

      if (hasAssignedDriverId(ride.driverId)) {
        throw new DriverDispatchError('ride_already_assigned', 'Cette course possède déjà un chauffeur.');
      }

      if (status !== 'En attente') {
        throw new DriverDispatchError(
          'ride_not_available',
          `Impossible d'attribuer une course au statut ${status}.`,
        );
      }

      if (['Annulée', 'Terminée', 'Expirée', 'Refusée'].includes(status)) {
        throw new DriverDispatchError('ride_closed', 'Impossible d\'attribuer cette course.');
      }

      const liveData = liveSnap.data() as Record<string, unknown> | undefined;
      if (!isLiveDriverAvailable(liveData)) {
        throw new DriverDispatchError('driver_not_available', 'Ce chauffeur est indisponible.');
      }

      if (profileSnap.exists()) {
        assertDriverProfileEligible(profileSnap.data() as Record<string, unknown>);
      }

      const dispatchAttempt = Number(ride.dispatchAttempt || 0) + 1;

      transaction.update(rideRef, {
        status: 'Attribuée',
        driverId: input.driverId,
        driverName: input.driverName,
        driverPhone: input.driverPhone,
        driverPhoto: input.driverPhoto,
        driverPlate: input.driverPlate,
        driverCar: input.driverCar,
        assignedAt: serverTimestamp(),
        dispatchAttempt,
        updatedAt: serverTimestamp(),
      });

      transaction.set(
        liveRef,
        {
          driverId: input.driverId,
          driverName: input.driverName,
          isBusy: true,
          currentRideId: input.rideId,
          availability: 'pending_accept',
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });

    devLog('[DISPATCH] assign success', {
      rideId: input.rideId,
      driverId: input.driverId,
    });
  } catch (error) {
    if (error instanceof DriverDispatchError) {
      devLog('[DISPATCH] assign aborted', {
        rideId: input.rideId,
        driverId: input.driverId,
        code: error.code,
        message: error.message,
      });
      throw error;
    }

    devError('[DISPATCH] assign failed', error);
    throw error;
  }
}

export type AcceptRideInput = {
  rideId: string;
  driverUid: string;
  driverName: string;
  driverPhone: string;
};

const RIDE_ALREADY_TAKEN_MESSAGE = 'Cette course a déjà été prise.';

const TAKEN_RIDE_STATUSES = new Set(['Acceptée', 'En route', 'Arrivé', 'Terminée']);

export async function acceptRide(
  input: AcceptRideInput,
): Promise<'assigned_accept' | 'pool_pick'> {
  devLog('[RIDE STATE] accept start', {
    rideId: input.rideId,
    driverUid: input.driverUid,
  });

  try {
    const result = await runTransaction(db, async (transaction) => {
      const rideRef = doc(db, 'rides', input.rideId);
      const liveRef = doc(db, 'driversLive', input.driverUid);
      const profileRef = doc(db, 'drivers', input.driverUid);

      const rideSnap = await transaction.get(rideRef);
      const liveSnap = await transaction.get(liveRef);
      const profileSnap = await transaction.get(profileRef);

      if (!rideSnap.exists()) {
        throw new DriverDispatchError('ride_not_found', 'Course introuvable.');
      }

      const ride = rideSnap.data() as Record<string, unknown>;
      const status = normalizeRideStatus(String(ride.status || ''));
      const assignedDriverId = String(ride.driverId || '').trim();
      const liveData = liveSnap.data() as Record<string, unknown> | undefined;
      const currentRideId = String(liveData?.currentRideId || '').trim();

      if (TAKEN_RIDE_STATUSES.has(status)) {
        throw new DriverDispatchError('ride_already_taken', RIDE_ALREADY_TAKEN_MESSAGE);
      }

      if (liveData?.isBusy && currentRideId && currentRideId !== input.rideId) {
        throw new DriverDispatchError(
          'driver_busy',
          'Vous avez déjà une course active.',
        );
      }

      if (status === 'Attribuée') {
        if (assignedDriverId !== input.driverUid) {
          throw new DriverDispatchError('ride_already_taken', RIDE_ALREADY_TAKEN_MESSAGE);
        }

        transaction.update(rideRef, {
          status: 'Acceptée',
          driverId: input.driverUid,
          acceptedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        transaction.set(
          liveRef,
          {
            driverId: input.driverUid,
            driverName: input.driverName,
            isBusy: true,
            currentRideId: input.rideId,
            availability: 'busy',
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        return 'assigned_accept' as const;
      }

      if (status === 'En attente') {
        if (hasAssignedDriverId(ride.driverId)) {
          throw new DriverDispatchError('ride_already_taken', RIDE_ALREADY_TAKEN_MESSAGE);
        }

        if (!liveData?.isOnline) {
          throw new DriverDispatchError(
            'driver_offline',
            'Passez en ligne pour accepter une course.',
          );
        }

        if (profileSnap.exists()) {
          assertDriverProfileEligible(profileSnap.data() as Record<string, unknown>);
        }

        if (!isLiveDriverAvailable(liveData)) {
          throw new DriverDispatchError(
            'driver_not_available',
            'Vous n\'êtes pas disponible pour cette course.',
          );
        }

        transaction.update(rideRef, {
          status: 'Acceptée',
          driverId: input.driverUid,
          driverName: input.driverName,
          driverPhone: input.driverPhone,
          acceptedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        transaction.set(
          liveRef,
          {
            driverId: input.driverUid,
            driverName: input.driverName,
            isBusy: true,
            currentRideId: input.rideId,
            availability: 'busy',
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );

        return 'pool_pick' as const;
      }

      throw new DriverDispatchError(
        'ride_not_acceptable',
        `Impossible d'accepter cette course (statut: ${status}).`,
      );
    });

    devLog('[RIDE STATE] accept success', {
      rideId: input.rideId,
      driverUid: input.driverUid,
      mode: result,
    });

    return result;
  } catch (error) {
    if (error instanceof DriverDispatchError) {
      devLog('[RIDE STATE] accept conflict', {
        rideId: input.rideId,
        driverUid: input.driverUid,
        code: error.code,
        message: error.message,
      });
      throw error;
    }

    devError('[RIDE STATE] accept failed', error);
    throw error;
  }
}

export type AssignNearestDriverCandidate = DriversLiveDoc & {
  id: string;
};

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

export async function assignRideToNearestEligibleDriver(params: {
  rideId: string;
  rideLatitude: number;
  rideLongitude: number;
  candidates: AssignNearestDriverCandidate[];
  profileByDriverId: Map<string, DriversProfileDoc>;
  rejectedDriverIds?: string[];
  getDistance: (
    from: { latitude: number; longitude: number },
    to: { latitude: number; longitude: number },
  ) => number;
}): Promise<{ driverId: string; driverName: string }> {
  const rejectedSet = new Set(params.rejectedDriverIds || []);

  const eligibleCandidates = params.candidates.filter((candidate) => {
    const driverId = resolveRegisteredDriverId(candidate, params.profileByDriverId);
    if (!driverId) return false;
    if (rejectedSet.has(driverId)) return false;
    const profile = params.profileByDriverId.get(driverId);
    return isDriverEligibleForDispatch(candidate, profile);
  });

  if (eligibleCandidates.length === 0) {
    throw new DriverDispatchError('no_driver', 'Aucun chauffeur disponible.');
  }

  const sortedCandidates = [...eligibleCandidates].sort((left, right) => {
    const distanceA = params.getDistance(
      { latitude: params.rideLatitude, longitude: params.rideLongitude },
      {
        latitude: left.latitude || 36.462,
        longitude: left.longitude || 7.426,
      },
    );
    const distanceB = params.getDistance(
      { latitude: params.rideLatitude, longitude: params.rideLongitude },
      {
        latitude: right.latitude || 36.462,
        longitude: right.longitude || 7.426,
      },
    );

    return distanceA - distanceB;
  });

  let lastError: DriverDispatchError | null = null;

  for (const candidate of sortedCandidates) {
    const driverId = resolveRegisteredDriverId(candidate, params.profileByDriverId);
    if (!driverId) continue;

    const driverName =
      candidate.driverName || candidate.name || 'Chauffeur PROTAXI';

    try {
      await assignRideToDriver({
        rideId: params.rideId,
        driverId,
        driverLiveDocId: candidate.id,
        driverName,
        driverPhone: candidate.driverPhone || candidate.phone || '',
        driverPhoto: candidate.photo || 'https://i.imgur.com/6VBx3io.png',
        driverPlate: candidate.plate || '24-000-16',
        driverCar: candidate.car || 'Renault Clio • Berline',
      });

      return { driverId, driverName };
    } catch (error) {
      if (
        error instanceof DriverDispatchError
        && ['driver_not_available', 'driver_not_approved', 'driver_suspended', 'driver_already_rejected'].includes(error.code)
      ) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new DriverDispatchError('no_driver', 'Aucun chauffeur disponible.');
}

export const DRIVER_LIVE_OFFLINE_PAYLOAD = {
  isOnline: false,
  isBusy: false,
  currentRideId: '',
  availability: 'offline' as DriverAvailability,
};
