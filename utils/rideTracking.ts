export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export const DEFAULT_GUELMA_CLIENT: MapCoordinate = {
  latitude: 36.462,
  longitude: 7.426,
};

export const DEFAULT_GUELMA_DESTINATION: MapCoordinate = {
  latitude: 36.279167,
  longitude: 7.437222,
};

export function normalizeRideTrackingStatus(status: unknown): string {
  const raw = String(status || '').trim();
  const lower = raw.toLowerCase();

  if (lower === 'en route' || lower === 'chauffeur en route') {
    return 'En route';
  }

  return raw || 'En attente';
}

export function isRideEnRoute(status: unknown): boolean {
  return normalizeRideTrackingStatus(status) === 'En route';
}

export function isRideTrackingFinished(status: unknown): boolean {
  const normalized = normalizeRideTrackingStatus(status).toLowerCase();
  return (
    normalized === 'terminée' ||
    normalized === 'terminee' ||
    normalized === 'annulée' ||
    normalized === 'annulee' ||
    normalized === 'expirée' ||
    normalized === 'expiree' ||
    normalized === 'refusée' ||
    normalized === 'refusee'
  );
}

export function parseRidePrice(
  price?: unknown,
  estimatedPrice?: unknown,
  totalPrice?: unknown,
): number {
  const raw = price ?? estimatedPrice ?? totalPrice ?? 0;
  return parseInt(String(raw).replace(/\D/g, ''), 10) || 0;
}

export function formatRidePriceDzd(
  price?: unknown,
  estimatedPrice?: unknown,
  totalPrice?: unknown,
): string {
  return `${parseRidePrice(price, estimatedPrice, totalPrice).toLocaleString('fr-FR')} DZD`;
}

export function parseCoordinateValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function buildMapCoordinate(
  latitude: unknown,
  longitude: unknown,
): MapCoordinate | null {
  const parsedLatitude = parseCoordinateValue(latitude);
  const parsedLongitude = parseCoordinateValue(longitude);

  if (parsedLatitude == null || parsedLongitude == null) {
    return null;
  }

  return {
    latitude: parsedLatitude,
    longitude: parsedLongitude,
  };
}

export function isValidMapCoordinate(
  coordinate: MapCoordinate | null | undefined,
): coordinate is MapCoordinate {
  if (!coordinate) return false;

  const { latitude, longitude } = coordinate;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return false;
  }

  if (latitude === 0 && longitude === 0) {
    return false;
  }

  return true;
}

export function coordinatesAreTooClose(
  origin: MapCoordinate,
  destination: MapCoordinate,
  threshold = 0.00015,
): boolean {
  return (
    Math.abs(origin.latitude - destination.latitude) +
      Math.abs(origin.longitude - destination.longitude) <
    threshold
  );
}

export function extractDriverLiveCoordinate(
  data: Record<string, unknown> | null | undefined,
): MapCoordinate | null {
  if (!data) return null;

  return buildMapCoordinate(data.latitude ?? data.lat, data.longitude ?? data.lng);
}

export function haversineDistanceMeters(
  a: MapCoordinate,
  b: MapCoordinate,
): number {
  const earthRadiusM = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusM * Math.asin(Math.sqrt(h));
}

export function getDriverLocationUpdatedAtMs(
  data: Record<string, unknown> | null | undefined,
): number {
  if (!data) return 0;

  const candidates = [data.locationUpdatedAt, data.updatedAt];
  for (const value of candidates) {
    if (value && typeof value === 'object' && 'toDate' in value) {
      const ms = (value as { toDate: () => Date }).toDate().getTime();
      if (Number.isFinite(ms)) return ms;
    }
    if (value instanceof Date) {
      const ms = value.getTime();
      if (Number.isFinite(ms)) return ms;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const ms = new Date(value).getTime();
      if (Number.isFinite(ms)) return ms;
    }
  }

  return 0;
}

export function isDriverMoving(speed: unknown, minMetersPerSecond = 1.2): boolean {
  const value = Number(speed);
  return Number.isFinite(value) && value >= minMetersPerSecond;
}

export function extractRideClientCoordinate(
  rideData: Record<string, unknown> | null | undefined,
  fallback: MapCoordinate,
): MapCoordinate {
  const fromRide = buildMapCoordinate(
    rideData?.clientLatitude ?? rideData?.latitude,
    rideData?.clientLongitude ?? rideData?.longitude,
  );

  return isValidMapCoordinate(fromRide) ? fromRide : fallback;
}

export function resolveRideDestinationCoordinate(options: {
  rideData?: Record<string, unknown> | null;
  paramLatitude?: unknown;
  paramLongitude?: unknown;
  clientPosition: MapCoordinate;
  fallback?: MapCoordinate;
}): MapCoordinate {
  const fallback = options.fallback ?? DEFAULT_GUELMA_DESTINATION;
  const candidates: Array<MapCoordinate | null> = [
    buildMapCoordinate(
      options.rideData?.destinationLatitude,
      options.rideData?.destinationLongitude,
    ),
    buildMapCoordinate(options.paramLatitude, options.paramLongitude),
    fallback,
  ];

  for (const candidate of candidates) {
    if (
      isValidMapCoordinate(candidate) &&
      !coordinatesAreTooClose(candidate, options.clientPosition)
    ) {
      return candidate;
    }
  }

  return {
    latitude: options.clientPosition.latitude + 0.01,
    longitude: options.clientPosition.longitude + 0.01,
  };
}

export function resolveTrackingDirections(options: {
  status: unknown;
  clientPosition: MapCoordinate;
  driverPosition: MapCoordinate;
  destinationPosition: MapCoordinate;
}): { origin: MapCoordinate; destination: MapCoordinate } | null {
  if (isRideTrackingFinished(options.status)) {
    return null;
  }

  const client = isValidMapCoordinate(options.clientPosition)
    ? options.clientPosition
    : DEFAULT_GUELMA_CLIENT;
  const driver = isValidMapCoordinate(options.driverPosition)
    ? options.driverPosition
    : client;
  const destination = isValidMapCoordinate(options.destinationPosition)
    ? options.destinationPosition
    : resolveRideDestinationCoordinate({ clientPosition: client });

  if (isRideEnRoute(options.status)) {
    if (!isValidMapCoordinate(client) || !isValidMapCoordinate(destination)) {
      return null;
    }

    if (coordinatesAreTooClose(client, destination)) {
      return null;
    }

    return { origin: client, destination };
  }

  if (!isValidMapCoordinate(driver) || !isValidMapCoordinate(client)) {
    return null;
  }

  if (coordinatesAreTooClose(driver, client)) {
    return null;
  }

  return { origin: driver, destination: client };
}
