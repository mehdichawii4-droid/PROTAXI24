export type DriverAvailability = 'offline' | 'available' | 'pending_accept' | 'busy';

export const SCHEDULED_AIRPORT_RIDE_MODE = 'Réserver plus tard';

export const SCHEDULED_AIRPORT_STATUSES = [
  'Confirmée',
  'À attribuer',
  'En attente confirmation chauffeur',
  'Chauffeur confirmé',
] as const;

export type ScheduledAirportStatus = (typeof SCHEDULED_AIRPORT_STATUSES)[number];

export const DRIVER_BUSY_RIDE_STATUSES = [
  'Attribuée',
  'Acceptée',
  'En attente confirmation chauffeur',
  'Chauffeur confirmé',
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
  if (normalized === 'confirmée' || normalized === 'confirmee') return 'Confirmée';
  if (normalized === 'à attribuer' || normalized === 'a attribuer') return 'À attribuer';
  if (
    normalized === 'en attente confirmation chauffeur'
    || normalized === 'en attente confirmation'
  ) {
    return 'En attente confirmation chauffeur';
  }
  if (normalized === 'chauffeur confirmé' || normalized === 'chauffeur confirme') {
    return 'Chauffeur confirmé';
  }
  if (normalized === 'expirée' || normalized === 'expiree') return 'Expirée';
  if (normalized === 'annulée' || normalized === 'annulee') return 'Annulée';

  return status || 'Inconnue';
}

export function isScheduledAirportRide(
  ride: { rideType?: unknown; rideMode?: unknown } | null | undefined,
): boolean {
  if (!ride) return false;
  return (
    String(ride.rideType || '') === 'airport'
    && String(ride.rideMode || '') === SCHEDULED_AIRPORT_RIDE_MODE
  );
}

export function isScheduledPrivateDriverRide(
  ride: { rideType?: unknown; rideMode?: unknown } | null | undefined,
): boolean {
  if (!ride) return false;
  return (
    String(ride.rideType || '') === 'private_driver'
    && String(ride.rideMode || '') === SCHEDULED_AIRPORT_RIDE_MODE
  );
}

export function isScheduledCityRide(
  ride: { rideType?: unknown; rideMode?: unknown } | null | undefined,
): boolean {
  if (!ride) return false;
  return (
    String(ride.rideType || '') === 'city'
    && String(ride.rideMode || '') === SCHEDULED_AIRPORT_RIDE_MODE
  );
}

type ImmediateCityRideContext = {
  rideType?: unknown;
  rideMode?: unknown;
  service?: unknown;
} | null | undefined;

/** Taxi Ville Maintenant — hors planifié, aéroport et chauffeur privé. */
export function isImmediateCityRide(ride: ImmediateCityRideContext): boolean {
  if (!ride) return false;
  if (isScheduledManagedRide(ride)) return false;

  const rideType = String(ride.rideType || '').trim();
  if (rideType === 'airport' || rideType === 'private_driver') return false;

  if (String(ride.rideMode || '').trim() !== 'Maintenant') return false;

  if (rideType === 'city') return true;

  const service = String(ride.service || '').toLowerCase();
  return service.includes('ville') || service.includes('24h');
}

/** Course ville immédiate en pool ouvert (En attente, sans chauffeur assigné). */
export function isOpenPoolCityRide(
  ride: (ImmediateCityRideContext & {
    status?: unknown;
    driverId?: unknown;
    openPool?: unknown;
  }) | null,
): boolean {
  if (!isImmediateCityRide(ride)) return false;
  if (normalizeRideStatus(String(ride?.status || '')) !== 'En attente') return false;
  if (hasAssignedDriverId(ride?.driverId)) return false;
  return ride?.openPool === true;
}

/** Demande pool ouverte visible pour un chauffeur (Taxi Ville Maintenant). */
export function isDriverOpenPoolCityRequest(
  ride: {
    rideType?: unknown;
    rideMode?: unknown;
    status?: unknown;
    driverId?: unknown;
    openPool?: unknown;
    rejectedDriverIds?: unknown;
  } | null,
  driverUid: string,
): boolean {
  const normalizedDriverUid = String(driverUid || '').trim();
  if (!normalizedDriverUid || !ride) return false;

  if (String(ride.rideType || '').trim() !== 'city') return false;
  if (String(ride.rideMode || '').trim() !== 'Maintenant') return false;
  if (normalizeRideStatus(String(ride.status || '')) !== 'En attente') return false;
  if (ride.openPool !== true) return false;
  if (hasAssignedDriverId(ride.driverId)) return false;

  const rejectedDriverIds = Array.isArray(ride.rejectedDriverIds)
    ? ride.rejectedDriverIds.map(String)
    : [];

  return !rejectedDriverIds.includes(normalizedDriverUid);
}

/** Transfert aéroport, chauffeur privé ou taxi ville planifié (même pipeline admin/chauffeur). */
export function isScheduledManagedRide(
  ride: { rideType?: unknown; rideMode?: unknown } | null | undefined,
): boolean {
  return (
    isScheduledAirportRide(ride)
    || isScheduledPrivateDriverRide(ride)
    || isScheduledCityRide(ride)
  );
}

export function getClientReservationStatusLabel(
  status: unknown,
  ride?: { rideType?: unknown; rideMode?: unknown } | null,
): string {
  const normalized = normalizeRideStatus(String(status || ''));

  if (isScheduledPrivateDriverRide(ride)) {
    switch (normalized) {
      case 'Confirmée':
        return 'Demande confirmée';
      case 'À attribuer':
        return 'Préparation en cours';
      case 'En attente confirmation chauffeur':
        return 'Chauffeur proposé';
      case 'Chauffeur confirmé':
        return 'Chauffeur confirmé';
      default:
        return normalized;
    }
  }

  if (isScheduledCityRide(ride)) {
    switch (normalized) {
      case 'Confirmée':
        return 'Course confirmée';
      case 'À attribuer':
        return 'Préparation en cours';
      case 'En attente confirmation chauffeur':
        return 'Chauffeur proposé';
      case 'Chauffeur confirmé':
        return 'Chauffeur confirmé';
      default:
        return normalized;
    }
  }

  if (!isScheduledAirportRide(ride)) {
    return normalized;
  }

  switch (normalized) {
    case 'Confirmée':
      return 'Transfert confirmé';
    case 'À attribuer':
      return 'Préparation en cours';
    case 'En attente confirmation chauffeur':
      return 'Chauffeur proposé';
    case 'Chauffeur confirmé':
      return 'Chauffeur confirmé';
    default:
      return normalized;
  }
}

export function canClientOpenCourseTracking(
  status: unknown,
  ride?: { rideType?: unknown; rideMode?: unknown } | null,
): boolean {
  const normalized = normalizeRideStatus(String(status || ''));

  if (isScheduledManagedRide(ride)) {
    return normalized === 'En route' || normalized === 'Arrivé';
  }

  return !['Annulée', 'Terminée', 'Expirée', 'Refusée'].includes(normalized);
}

export function canClientCancelReservation(
  status: unknown,
  ride?: { rideType?: unknown; rideMode?: unknown } | null,
): boolean {
  const normalized = normalizeRideStatus(String(status || ''));

  if (isScheduledManagedRide(ride)) {
    return [
      'Confirmée',
      'À attribuer',
      'En attente confirmation chauffeur',
      'Chauffeur confirmé',
    ].includes(normalized);
  }

  return ['En attente', 'Attribuée', 'Acceptée'].includes(normalized);
}

export function shouldShowAssignedDriverToClient(
  status: unknown,
  ride?: { rideType?: unknown; rideMode?: unknown } | null,
): boolean {
  const normalized = normalizeRideStatus(String(status || ''));

  if (isScheduledManagedRide(ride)) {
    return ['Chauffeur confirmé', 'En route', 'Arrivé', 'Terminée'].includes(normalized);
  }

  return ['Attribuée', 'Acceptée', 'En route', 'Arrivé', 'Terminée'].includes(normalized);
}

export function hasAssignedDriverId(driverId: unknown): boolean {
  return String(driverId || '').trim().length > 0;
}

/** Vibration / mise en avant dashboard : taxi immédiat ou mission planifiée proposée. */
export function isDriverAssignmentAlert(
  ride: { rideType?: unknown; rideMode?: unknown } | null | undefined,
  status: unknown,
): boolean {
  const normalized = normalizeRideStatus(String(status ?? ''));

  if (normalized === 'Attribuée') {
    return true;
  }

  if (normalized === 'En attente confirmation chauffeur') {
    return isScheduledManagedRide(ride);
  }

  return false;
}

export const DRIVER_ASSIGNMENT_FOCUS_STATUSES = [
  'Attribuée',
  'En attente confirmation chauffeur',
] as const;

export type RideAvailabilityContext = {
  id?: string;
  status?: string;
  rideType?: unknown;
  rideMode?: unknown;
  mode?: unknown;
  airport?: unknown;
  destinationId?: unknown;
  date?: unknown;
  scheduledAt?: { toDate?: () => Date } | Date | string | null;
};

const DEPOSER_APPROACH_MS = 20 * 60 * 1000;

type ScheduledAirportKey = 'annaba' | 'constantine' | 'alger' | 'tunis' | 'other';

const RECUPERER_APPROACH_MS: Record<ScheduledAirportKey, number> = {
  annaba: 2 * 60 * 60 * 1000,
  constantine: 2.5 * 60 * 60 * 1000,
  alger: 8 * 60 * 60 * 1000,
  tunis: 8 * 60 * 60 * 1000,
  other: 4 * 60 * 60 * 1000,
};

function resolveScheduledAtMs(ride: RideAvailabilityContext): number | null {
  const scheduledAt = ride.scheduledAt;
  if (
    scheduledAt
    && typeof scheduledAt === 'object'
    && 'toDate' in scheduledAt
    && typeof scheduledAt.toDate === 'function'
  ) {
    const date = scheduledAt.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
  }

  if (scheduledAt instanceof Date && !Number.isNaN(scheduledAt.getTime())) {
    return scheduledAt.getTime();
  }

  return null;
}

/** Planifié premium dont le créneau scheduledAt est encore dans le futur. */
export function isScheduledManagedRideInFuture(
  ride: RideAvailabilityContext | null | undefined,
): boolean {
  if (!isScheduledManagedRide(ride)) {
    return false;
  }

  const scheduledMs = resolveScheduledAtMs(ride ?? {});
  if (scheduledMs === null) {
    return true;
  }

  return scheduledMs > Date.now();
}

/** Planifié aéroport dont le créneau scheduledAt est encore dans le futur. */
export function isScheduledAirportRideInFuture(
  ride: RideAvailabilityContext | null | undefined,
): boolean {
  if (!isScheduledAirportRide(ride)) {
    return false;
  }

  return isScheduledManagedRideInFuture(ride);
}

function isTransferDateToday(ride: RideAvailabilityContext): boolean {
  const dateStr = String(ride.date || '').trim();
  if (!dateStr || dateStr === 'À confirmer' || dateStr === 'Maintenant') {
    return false;
  }
  return dateStr === new Date().toLocaleDateString('fr-FR');
}

function resolveScheduledAirportKey(ride: RideAvailabilityContext): ScheduledAirportKey {
  const destinationId = String(ride.destinationId || '').toLowerCase().trim();
  if (
    destinationId === 'annaba'
    || destinationId === 'constantine'
    || destinationId === 'alger'
    || destinationId === 'tunis'
  ) {
    return destinationId;
  }

  const airportText = String(ride.airport || '').toLowerCase();
  if (airportText.includes('annaba') || airportText.includes('aae')) return 'annaba';
  if (airportText.includes('constantine') || airportText.includes('czl')) {
    return 'constantine';
  }
  if (
    airportText.includes('alger')
    || airportText.includes('alg')
    || airportText.includes('houari')
  ) {
    return 'alger';
  }
  if (
    airportText.includes('tunis')
    || airportText.includes('tun')
    || airportText.includes('carthage')
  ) {
    return 'tunis';
  }

  return 'other';
}

function getApproachLeadMs(ride: RideAvailabilityContext): number {
  const transferMode = String(ride.mode || '').trim();
  if (transferMode === 'recuperer') {
    return RECUPERER_APPROACH_MS[resolveScheduledAirportKey(ride)];
  }
  return DEPOSER_APPROACH_MS;
}

/**
 * Transfert aéroport planifié : le chauffeur peut-il afficher « Démarrer le transfert » ?
 * - deposer : à partir de 20 min avant scheduledAt
 * - recuperer : fenêtre d'approche selon l'aéroport (Annaba 2h, Constantine 2h30, Alger/Tunis 8h, autre 4h)
 * - scheduledAt absent : fallback date du jour (texte fr-FR)
 */
export function canDriverStartScheduledAirportTransfer(
  ride: RideAvailabilityContext | null | undefined,
): boolean {
  if (!ride || !isScheduledAirportRide(ride)) {
    return false;
  }

  const scheduledMs = resolveScheduledAtMs(ride);
  if (scheduledMs === null) {
    return isTransferDateToday(ride);
  }

  const now = Date.now();
  if (now >= scheduledMs) {
    return true;
  }

  return now >= scheduledMs - getApproachLeadMs(ride);
}

/** Indique si une course verrouille le chauffeur pour le dispatch / pool temps réel. */
export function doesRideBlockRealtimeAvailability(
  ride: RideAvailabilityContext | null | undefined,
): boolean {
  if (!ride) {
    return false;
  }

  const status = normalizeRideStatus(ride.status);

  if (isScheduledManagedRide(ride)) {
    if (status === 'En attente confirmation chauffeur') {
      return false;
    }

    if (status === 'Chauffeur confirmé') {
      return !isScheduledManagedRideInFuture(ride);
    }

    if (status === 'En route' || status === 'Arrivé') {
      return true;
    }

    return false;
  }

  if (status === 'Attribuée') {
    return true;
  }

  return DRIVER_ACTIVE_RIDE_STATUSES.includes(
    status as (typeof DRIVER_ACTIVE_RIDE_STATUSES)[number],
  );
}

export function computeIsBusyFromRides(
  rides: RideAvailabilityContext[],
): boolean {
  return rides.some((ride) => doesRideBlockRealtimeAvailability(ride));
}

export function computeAvailabilityFromRides(
  isOnline: boolean,
  rides: RideAvailabilityContext[],
): DriverAvailability {
  if (!isOnline) {
    return 'offline';
  }

  const blockingRides = rides.filter((ride) => doesRideBlockRealtimeAvailability(ride));

  if (
    blockingRides.some((ride) =>
      DRIVER_ACTIVE_RIDE_STATUSES.includes(
        normalizeRideStatus(ride.status) as (typeof DRIVER_ACTIVE_RIDE_STATUSES)[number],
      ),
    )
  ) {
    return 'busy';
  }

  if (blockingRides.some((ride) => normalizeRideStatus(ride.status) === 'Attribuée')) {
    return 'pending_accept';
  }

  return 'available';
}

export function buildDriverLiveAvailabilityPayload(
  isOnline: boolean,
  rides: RideAvailabilityContext[],
) {
  const availability = computeAvailabilityFromRides(isOnline, rides);
  const isBusy = availability === 'pending_accept' || availability === 'busy';
  const blockingRide = rides.find((ride) => doesRideBlockRealtimeAvailability(ride));

  return {
    isOnline,
    isBusy,
    availability,
    currentRideId: isBusy && blockingRide?.id ? String(blockingRide.id) : '',
  };
}

export function getDriverLiveStateAfterRideTransition(
  isOnline: boolean,
  finalStatus: string,
  rideId: string,
  ride?: RideAvailabilityContext | null,
): {
  isBusy: boolean;
  availability: DriverAvailability;
  currentRideId: string;
} {
  const normalized = normalizeRideStatus(finalStatus);
  const rideContext = ride
    ? { ...ride, status: normalized }
    : { status: normalized };

  if (normalized === 'Refusée' || normalized === 'Terminée') {
    return {
      isBusy: false,
      availability: isOnline ? 'available' : 'offline',
      currentRideId: '',
    };
  }

  if (normalized === 'En attente confirmation chauffeur') {
    return {
      isBusy: false,
      availability: isOnline ? 'available' : 'offline',
      currentRideId: '',
    };
  }

  if (
    normalized === 'Chauffeur confirmé'
    && isScheduledManagedRide(rideContext)
    && isScheduledManagedRideInFuture(rideContext)
  ) {
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

  if (normalized === 'Chauffeur confirmé') {
    return {
      isBusy: true,
      availability: 'busy',
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
