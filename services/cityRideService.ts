import { addDoc, collection } from 'firebase/firestore';
import { router } from 'expo-router';

import { db } from '@/firebaseConfig';
import { pickPartnerFieldsFromParams } from '@/services/partnerService';
import { buildRidePaymentCreateFields } from '@/services/ridePayment';
import { buildMapCoordinate, isValidMapCoordinate } from '@/utils/rideTracking';

export type CityRideMode = 'Maintenant' | 'Réserver plus tard';

export type CityRideInput = {
  service?: string;
  destinationType?: string;
  departure: string;
  destination: string;
  rideMode: CityRideMode;
  date?: string;
  time?: string;
  waitingTime?: string;
  passengers?: string;
  bags?: string;
  fullName?: string;
  phone?: string;
  notes?: string;
  price: string;
  vehicleType?: string;
  estimatedDuration?: number;
  estimatedPrice?: number;
  pickupLatitude?: number;
  pickupLongitude?: number;
  partnerId?: string;
  partnerName?: string;
};

export type CityRideProfileContext = {
  clientUid?: string | null;
  profileFullName?: string | null;
  profilePhone?: string | null;
};

export type SubmitCityRideResult =
  | { status: 'scheduled' }
  | { status: 'tracking'; rideId: string }
  | { status: 'auth_required' }
  | { status: 'missing_ride_id' }
  | { status: 'error'; error: unknown };

export function cleanCityRidePrice(price: string) {
  return String(price || 'Sur confirmation').replace(' DA', '');
}

function getParam(value: string | string[] | undefined, fallback = '') {
  return String(Array.isArray(value) ? value[0] : value || fallback);
}

export function cityRideInputFromParams(
  params: Record<string, string | string[] | undefined>,
): CityRideInput {
  return {
    service: getParam(params.service, 'Ville 24H'),
    destinationType: getParam(params.destinationType),
    departure: getParam(params.departure, 'Départ à confirmer'),
    destination: getParam(params.destination, 'Destination à confirmer'),
    rideMode: getParam(params.rideMode, 'Maintenant') as CityRideMode,
    date: getParam(params.date),
    time: getParam(params.time),
    waitingTime: getParam(params.waitingTime),
    passengers: getParam(params.passengers),
    bags: getParam(params.bags),
    fullName: getParam(params.fullName),
    phone: getParam(params.phone),
    notes: getParam(params.notes),
    price: getParam(params.price, 'Sur confirmation'),
    partnerId: getParam(params.partnerId),
    partnerName: getParam(params.partnerName),
  };
}

export async function submitCityRide(
  input: CityRideInput,
  context: CityRideProfileContext,
): Promise<SubmitCityRideResult> {
  const rideMode = input.rideMode || 'Maintenant';
  const priceClean = cleanCityRidePrice(input.price);

  if (rideMode === 'Réserver plus tard') {
    const clientUid = context.clientUid?.trim();
    if (!clientUid) {
      return { status: 'auth_required' };
    }

    router.push({
      pathname: '/confirmation',
      params: {
        service: input.service || 'Ville 24H',
        departure: input.departure || 'Départ à confirmer',
        destination: input.destination || 'Destination à confirmer',
        date: input.date || 'À confirmer',
        time: input.time || 'À confirmer',
        price: priceClean,
        rideMode: 'Réserver plus tard',
        passengers: String(input.passengers || '1'),
        bags: String(input.bags || '0'),
        fullName:
          String(input.fullName || '').trim() ||
          String(context.profileFullName || '').trim() ||
          'Client PROTAXI',
        phone: String(input.phone || context.profilePhone || 'Non renseigné'),
        notes: String(input.notes || ''),
        message: 'Votre course a été programmée avec succès.',
        ...pickPartnerFieldsFromParams({
          partnerId: input.partnerId,
          partnerName: input.partnerName,
        }),
      },
    });
    return { status: 'scheduled' };
  }

  const clientUid = context.clientUid?.trim();
  if (!clientUid) {
    return { status: 'auth_required' };
  }

  try {
    const departure = String(input.departure || 'Départ à confirmer');
    const destination = String(input.destination || 'Destination à confirmer');
    const price = String(input.price || 'Sur confirmation');
    const clientName =
      String(input.fullName || '').trim() ||
      String(context.profileFullName || '').trim() ||
      'Client PROTAXI';

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

    const rideDoc = await addDoc(collection(db, 'rides'), {
      clientUid,
      clientName,
      client: clientName,
      phone: String(input.phone || context.profilePhone || 'Non renseigné'),
      service: String(input.service || 'Ville 24H'),
      departure,
      destination,
      address: departure,
      price,
      time: 'Maintenant',
      date: 'Maintenant',
      passengers: String(input.passengers || '1'),
      bags: String(input.bags || '0'),
      rideMode: 'Maintenant',
      status: 'En attente',
      vehicleType: String(input.vehicleType || ''),
      estimatedDuration: input.estimatedDuration ?? 0,
      estimatedPrice: input.estimatedPrice ?? 0,
      driverName: '',
      driverPhone: '',
      driverCar: '',
      driverId: '',
      createdAt: new Date(),
      ...buildRidePaymentCreateFields({
        price,
        estimatedPrice: input.estimatedPrice,
      }),
      ...pickupFields,
      ...partnerFields,
    });

    if (!rideDoc.id) {
      return { status: 'missing_ride_id' };
    }

    router.replace({
      pathname: '/course-tracking',
      params: {
        id: rideDoc.id,
        rideId: rideDoc.id,
        service: input.service || 'Ville 24H',
        departure,
        destination,
        address: departure,
        airport: destination,
        time: 'Maintenant',
        price: priceClean,
        status: 'En attente',
        vehicleType: String(input.vehicleType || ''),
        estimatedDuration: String(input.estimatedDuration ?? ''),
        estimatedPrice: String(input.estimatedPrice ?? ''),
      },
    });

    return { status: 'tracking', rideId: rideDoc.id };
  } catch (error) {
    return { status: 'error', error };
  }
}
