export type DriverAvailability = 'offline' | 'available' | 'pending_accept' | 'busy';

export const DRIVER_BUSY_RIDE_STATUSES = [
  'Attribuée',
  'Acceptée',
  'En route',
  'Arrivé',
] as const;

export type DriverBusyRideStatus = (typeof DRIVER_BUSY_RIDE_STATUSES)[number];

export const DRIVER_ACTIVE_RIDE_STATUSES = ['Acceptée', 'En route', 'Arrivé'] as const;

export function normalizeRideStatus(status?: string): string {
  const normalized = String(status || '').toLowerCase().trim();

  if (normalized === 'attribuée' || normalized === 'attribuee') return 'Attribuée';
  if (normalized === 'acceptée' || normalized === 'acceptee') return 'Acceptée';
  if (normalized === 'en route') return 'En route';
  if (normalized === 'arrivé' || normalized === 'arrive') return 'Arrivé';
  if (normalized === 'terminée' || normalized === 'terminee') return 'Terminée';
  if (normalized === 'refusée' || normalized === 'refusee') return 'Refusée';
  if (normalized === 'en attente') return 'En attente';
  if (normalized === 'expirée' || normalized === 'expiree') return 'Expirée';
  if (normalized === 'annulée' || normalized === 'annulee') return 'Annulée';

  return status || 'Inconnue';
}

export function hasAssignedDriverId(driverId: unknown): boolean {
  return String(driverId || '').trim().length > 0;
}

export function computeIsBusyFromRides(rides: { status?: string }[]): boolean {
  return rides.some((ride) =>
    DRIVER_BUSY_RIDE_STATUSES.includes(
      normalizeRideStatus(ride.status) as DriverBusyRideStatus,
    ),
  );
}

export function computeAvailabilityFromRides(
  isOnline: boolean,
  rides: { status?: string }[],
): DriverAvailability {
  if (!isOnline) {
    return 'offline';
  }

  const statuses = rides.map((ride) => normalizeRideStatus(ride.status));

  if (statuses.some((status) => DRIVER_ACTIVE_RIDE_STATUSES.includes(status as (typeof DRIVER_ACTIVE_RIDE_STATUSES)[number]))) {
    return 'busy';
  }

  if (statuses.includes('Attribuée')) {
    return 'pending_accept';
  }

  return 'available';
}

export function buildDriverLiveAvailabilityPayload(
  isOnline: boolean,
  rides: { status?: string; id?: string }[],
) {
  const availability = computeAvailabilityFromRides(isOnline, rides);
  const isBusy = availability === 'pending_accept' || availability === 'busy';
  const busyRide = rides.find((ride) =>
    DRIVER_BUSY_RIDE_STATUSES.includes(
      normalizeRideStatus(ride.status) as DriverBusyRideStatus,
    ),
  );

  return {
    isOnline,
    isBusy,
    availability,
    currentRideId: isBusy && busyRide?.id ? String(busyRide.id) : '',
  };
}

export function getDriverLiveStateAfterRideTransition(
  isOnline: boolean,
  finalStatus: string,
  rideId: string,
): {
  isBusy: boolean;
  availability: DriverAvailability;
  currentRideId: string;
} {
  const normalized = normalizeRideStatus(finalStatus);

  if (normalized === 'Refusée' || normalized === 'Terminée') {
    return {
      isBusy: false,
      availability: isOnline ? 'available' : 'offline',
      currentRideId: '',
    };
  }

  if (normalized === 'Attribuée') {
    return {
      isBusy: true,
      availability: 'pending_accept',
      currentRideId: rideId,
    };
  }

  if (DRIVER_ACTIVE_RIDE_STATUSES.includes(normalized as (typeof DRIVER_ACTIVE_RIDE_STATUSES)[number])) {
    return {
      isBusy: true,
      availability: 'busy',
      currentRideId: rideId,
    };
  }

  return {
    isBusy: false,
    availability: isOnline ? 'available' : 'offline',
    currentRideId: '',
  };
}
