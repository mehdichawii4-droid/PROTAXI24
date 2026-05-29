import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { router } from 'expo-router';

import { db } from '@/firebaseConfig';
import { resolveAirportPickupAddress } from '@/services/airportRideService';
import { pickPartnerFieldsFromParams } from '@/services/partnerService';
import { buildRidePaymentCreateFields } from '@/services/ridePayment';
import { SCHEDULED_AIRPORT_RIDE_MODE } from '@/types/driver';
import { buildMapCoordinate, isValidMapCoordinate } from '@/utils/rideTracking';

export type PrivateDriverType = 'trajet' | 'disposition';

export const PRIVATE_DRIVER_DURATION_OPTIONS = [
  { id: '2', label: '2 heures' },
  { id: '4', label: '4 heures' },
  { id: '8', label: '8 heures' },
  { id: '12', label: 'Journée' },
] as const;

export type PrivateDriverRideInput = {
  privateDriverType: PrivateDriverType;
  departure: string;
  destination: string;
  scheduledAt: Date;
  passengers: string;
  durationHours?: string;
  notes?: string;
  price?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  partnerId?: string;
  partnerName?: string;
};

export type PrivateDriverRideProfileContext = {
  clientUid?: string | null;
  profileFullName?: string | null;
  profilePhone?: string | null;
};

export type SubmitPrivateDriverRideResult =
  | { status: 'confirmed'; rideId: string }
  | { status: 'auth_required' }
  | { status: 'missing_ride_id' }
  | { status: 'error'; error: unknown };

export const PRIVATE_DRIVER_PRICE_LABEL = 'Sur confirmation';

export function getPrivateDriverTypeLabel(type: PrivateDriverType): string {
  return type === 'disposition' ? 'Chauffeur à disposition' : 'Trajet privé';
}

export function formatPrivateDriverDuration(hours?: string): string {
  const value = String(hours || '').trim();
  if (!value) return '—';
  const option = PRIVATE_DRIVER_DURATION_OPTIONS.find((item) => item.id === value);
  return option?.label || `${value} h`;
}

export async function resolvePrivateDriverPickupAddress(): Promise<{
  address: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
}> {
  return resolveAirportPickupAddress();
}

export async function submitPrivateDriverRide(
  input: PrivateDriverRideInput,
  context: PrivateDriverRideProfileContext,
): Promise<SubmitPrivateDriverRideResult> {
  const clientUid = context.clientUid?.trim();
  if (!clientUid) {
    return { status: 'auth_required' };
  }

  const privateDriverType = input.privateDriverType;
  const departure = String(input.departure || 'À confirmer').trim();
  const destinationRaw = String(input.destination || '').trim();
  const destination =
    destinationRaw
    || (privateDriverType === 'disposition' ? 'Selon programme' : 'À confirmer');
  const price = String(input.price || PRIVATE_DRIVER_PRICE_LABEL);
  const clientName =
    String(context.profileFullName || '').trim() || 'Client PROTAXI';
  const phone = String(context.profilePhone || 'Non renseigné');
  const scheduledAt = input.scheduledAt;

  if (!(scheduledAt instanceof Date) || Number.isNaN(scheduledAt.getTime())) {
    return { status: 'error', error: new Error('invalid_scheduled_at') };
  }

  const partnerFields = pickPartnerFieldsFromParams({
    partnerId: input.partnerId,
    partnerName: input.partnerName,
  });

  const pickup = buildMapCoordinate(input.pickupLatitude, input.pickupLongitude);
  const pickupFields = isValidMapCoordinate(pickup)
    ? {
        clientLatitude: pickup.latitude,
        clientLongitude: pickup.longitude,
        latitude: pickup.latitude,
        longitude: pickup.longitude,
      }
    : {};

  const date = scheduledAt.toLocaleDateString('fr-FR');
  const time = scheduledAt.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const notes = String(input.notes || '').trim();
  const durationHours =
    privateDriverType === 'disposition'
      ? String(input.durationHours || '').trim()
      : '';

  try {
    const rideDoc = await addDoc(collection(db, 'rides'), {
      clientUid,
      clientName,
      client: clientName,
      phone,
      service: 'Chauffeur privé',
      rideType: 'private_driver',
      rideMode: SCHEDULED_AIRPORT_RIDE_MODE,
      status: 'Confirmée',
      mode: privateDriverType,
      privateDriverType,
      departure,
      destination,
      address: departure,
      date,
      time,
      passengers: String(input.passengers || '1'),
      durationHours,
      notes,
      price,
      driverName: '',
      driverPhone: '',
      driverCar: '',
      driverId: '',
      createdAt: new Date(),
      scheduledAt: Timestamp.fromDate(scheduledAt),
      ...buildRidePaymentCreateFields({ price }),
      ...pickupFields,
      ...partnerFields,
    });

    if (!rideDoc.id) {
      return { status: 'missing_ride_id' };
    }

    router.replace({
      pathname: '/reservation-view',
      params: {
        id: rideDoc.id,
        rideId: rideDoc.id,
        service: 'Chauffeur privé',
        rideType: 'private_driver',
        rideMode: SCHEDULED_AIRPORT_RIDE_MODE,
        status: 'Confirmée',
        mode: privateDriverType,
        privateDriverType,
        departure,
        destination,
        address: departure,
        date,
        time,
        passengers: String(input.passengers || '1'),
        durationHours,
        notes,
        price,
      },
    });

    return { status: 'confirmed', rideId: rideDoc.id };
  } catch (error) {
    return { status: 'error', error };
  }
}
