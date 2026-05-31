export const SCHEDULED_RIDE_MODE = 'Réserver plus tard';
export const MAX_IMMEDIATE_CITY_OPEN_POOL_REDISPATCH = 3;

type RideScopeContext = Record<string, unknown> | null | undefined;

function hasAssignedDriverId(driverId: unknown): boolean {
  return String(driverId || '').trim().length > 0;
}

function isScheduledManagedRide(ride: RideScopeContext): boolean {
  if (!ride) return false;
  const rideType = String(ride.rideType || '').trim();
  const rideMode = String(ride.rideMode || '').trim();
  return (
    (rideType === 'airport' && rideMode === SCHEDULED_RIDE_MODE)
    || (rideType === 'private_driver' && rideMode === SCHEDULED_RIDE_MODE)
    || (rideType === 'city' && rideMode === SCHEDULED_RIDE_MODE)
  );
}

/** Taxi Ville Maintenant — hors planifié, aéroport et chauffeur privé. */
export function isImmediateCityRide(ride: RideScopeContext): boolean {
  if (!ride) return false;
  if (isScheduledManagedRide(ride)) return false;

  const rideType = String(ride.rideType || '').trim();
  if (rideType === 'airport' || rideType === 'private_driver') return false;

  if (String(ride.rideMode || '').trim() !== 'Maintenant') return false;

  if (rideType === 'city') return true;

  const service = String(ride.service || '').toLowerCase();
  return service.includes('ville') || service.includes('24h');
}

export function shouldSkipAutoDispatchForOpenPool(ride: RideScopeContext): boolean {
  if (!isImmediateCityRide(ride)) return false;
  if (ride?.openPool === true) return true;

  const redispatchCount = Number(ride?.redispatchCount ?? 0);
  return redispatchCount >= MAX_IMMEDIATE_CITY_OPEN_POOL_REDISPATCH;
}
