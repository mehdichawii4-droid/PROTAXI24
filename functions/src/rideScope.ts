export const SCHEDULED_RIDE_MODE = 'Réserver plus tard';
/** Une seule tentative auto-dispatch pour Taxi Ville Maintenant, puis pool ouvert. */
export const MAX_IMMEDIATE_CITY_AUTO_ASSIGN_ATTEMPTS = 1;

type RideScopeContext = Record<string, unknown> | null | undefined;

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

  const dispatchAttempt = Number(ride?.dispatchAttempt ?? 0);
  const redispatchCount = Number(ride?.redispatchCount ?? 0);

  return (
    dispatchAttempt >= MAX_IMMEDIATE_CITY_AUTO_ASSIGN_ATTEMPTS
    || redispatchCount >= 1
  );
}
