import * as Location from 'expo-location';

import { MapCoordinate } from '@/components/CityBookingMap.types';

export function formatReverseGeocode(
  place?: Location.LocationGeocodedAddress,
): string {
  if (!place) return 'Point sélectionné';

  const parts = [place.street, place.district, place.city, place.region].filter(
    (part) => Boolean(part?.trim()),
  );

  return parts.length > 0 ? parts.join(', ') : 'Point sélectionné';
}

export async function reverseGeocodeCoordinate(
  coordinate: MapCoordinate,
): Promise<string> {
  const results = await Location.reverseGeocodeAsync(coordinate);
  return formatReverseGeocode(results[0]);
}
