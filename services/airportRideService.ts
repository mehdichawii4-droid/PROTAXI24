import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { router } from 'expo-router';
import * as Location from 'expo-location';

import { db } from '@/firebaseConfig';
import { pickPartnerFieldsFromParams } from '@/services/partnerService';
import { buildRidePaymentCreateFields } from '@/services/ridePayment';
import { reverseGeocodeCoordinate } from '@/utils/cityMapGeocode';
import { buildMapCoordinate, isValidMapCoordinate } from '@/utils/rideTracking';

export type AirportDestinationId =
  | 'annaba'
  | 'constantine'
  | 'alger'
  | 'tunis'
  | 'other';

export type AirportTransferMode = 'deposer' | 'recuperer';
export type AirportRideMode = 'Maintenant' | 'Réserver plus tard';

export type AirportRideInput = {
  airport: string;
  transferMode: AirportTransferMode;
  rideMode: AirportRideMode;
  address: string;
  date: string;
  time: string;
  passengers: string;
  bags: string;
  price: string;
  flightNumber?: string;
  airline?: string;
  terminal?: string;
  meetAndGreet?: boolean;
  luggageNotes?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  scheduledAt?: Date;
  partnerId?: string;
  partnerName?: string;
};

export type AirportRideProfileContext = {
  clientUid?: string | null;
  profileFullName?: string | null;
  profilePhone?: string | null;
};

export type SubmitAirportRideResult =
  | { status: 'tracking'; rideId: string }
  | { status: 'scheduled'; rideId: string }
  | { status: 'auth_required' }
  | { status: 'missing_ride_id' }
  | { status: 'error'; error: unknown };

const AIRPORT_PRICES: Record<Exclude<AirportDestinationId, 'other'>, number> = {
  annaba: 4000,
  constantine: 5000,
  alger: 20000,
  tunis: 20000,
};

export const AIRPORT_DESTINATIONS = [
  { id: 'annaba' as const, label: 'Annaba', code: 'AAE', sub: 'Aéroport Rabah Bitat' },
  { id: 'constantine' as const, label: 'Constantine', code: 'CZL', sub: 'Mohamed Boudiaf' },
  { id: 'alger' as const, label: 'Alger', code: 'ALG', sub: 'Houari Boumediene' },
  { id: 'tunis' as const, label: 'Tunis', code: 'TUN', sub: 'Carthage' },
  { id: 'other' as const, label: 'Autre', code: '—', sub: 'Sur devis' },
];

export function formatAirportLabel(
  destinationId: AirportDestinationId,
  customAirport = '',
): string {
  if (destinationId === 'other') {
    return customAirport.trim() || 'Aéroport sur devis';
  }
  const found = AIRPORT_DESTINATIONS.find((item) => item.id === destinationId);
  if (!found) return 'Aéroport';
  return `${found.label} (${found.code})`;
}

export function getAirportEstimate(
  destinationId: AirportDestinationId,
): { amount: number; label: string } {
  if (destinationId === 'other') {
    return { amount: 0, label: 'Sur devis' };
  }
  const amount = AIRPORT_PRICES[destinationId];
  return {
    amount,
    label: `${amount.toLocaleString('fr-FR')} DA`,
  };
}

export async function resolveAirportPickupAddress(): Promise<{
  address: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
}> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { address: 'Adresse à confirmer avec le chauffeur' };
    }

    const position = await Location.getCurrentPositionAsync({});
    const coordinate = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    const address = await reverseGeocodeCoordinate(coordinate);
    return {
      address: address || 'Ma position actuelle',
      pickupLatitude: coordinate.latitude,
      pickupLongitude: coordinate.longitude,
    };
  } catch {
    return { address: 'Adresse à confirmer avec le chauffeur' };
  }
}

function buildRouteFields(
  transferMode: AirportTransferMode,
  airport: string,
  address: string,
) {
  if (transferMode === 'deposer') {
    return {
      departure: address,
      destination: airport,
      address,
      airport,
    };
  }
  return {
    departure: airport,
    destination: address,
    address,
    airport,
  };
}

export async function submitAirportRide(
  input: AirportRideInput,
  context: AirportRideProfileContext,
): Promise<SubmitAirportRideResult> {
  const clientUid = context.clientUid?.trim();
  if (!clientUid) {
    return { status: 'auth_required' };
  }

  const rideMode = input.rideMode || 'Maintenant';
  const airport = String(input.airport || 'À confirmer').trim();
  const address = String(input.address || 'À confirmer').trim();
  const price = String(input.price || 'Sur devis');
  const route = buildRouteFields(input.transferMode, airport, address);
  const clientName =
    String(context.profileFullName || '').trim() || 'Client PROTAXI';
  const phone = String(context.profilePhone || 'Non renseigné');

  const partnerFields = pickPartnerFieldsFromParams({
    partnerId: input.partnerId,
    partnerName: input.partnerName,
  });

  const pickup = buildMapCoordinate(input.pickupLatitude, input.pickupLongitude);
  const pickupFields =
    rideMode === 'Maintenant' && isValidMapCoordinate(pickup)
      ? {
          clientLatitude: pickup.latitude,
          clientLongitude: pickup.longitude,
          latitude: pickup.latitude,
          longitude: pickup.longitude,
        }
      : {};

  const premiumNotes = [
    input.airline?.trim() ? `Compagnie: ${input.airline.trim()}` : '',
    input.terminal?.trim() ? `Terminal: ${input.terminal.trim()}` : '',
    input.meetAndGreet ? 'Pancarte accueil: oui' : '',
    input.luggageNotes?.trim() ? `Bagages: ${input.luggageNotes.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const isScheduled = rideMode === 'Réserver plus tard';
  const initialStatus = isScheduled ? 'Confirmée' : 'En attente';
  const scheduledAtField =
    isScheduled && input.scheduledAt instanceof Date && !Number.isNaN(input.scheduledAt.getTime())
      ? { scheduledAt: Timestamp.fromDate(input.scheduledAt) }
      : {};

  try {
    const rideDoc = await addDoc(collection(db, 'rides'), {
      clientUid,
      clientName,
      client: clientName,
      phone,
      service: 'Transfert aéroport',
      rideType: 'airport',
      rideMode,
      mode: input.transferMode,
      ...route,
      date: String(input.date || (rideMode === 'Maintenant' ? 'Maintenant' : 'À confirmer')),
      time: String(input.time || (rideMode === 'Maintenant' ? 'Maintenant' : '—')),
      passengers: String(input.passengers || '1'),
      bags: String(input.bags || '0'),
      price,
      status: initialStatus,
      flightNumber: String(input.flightNumber || '').trim(),
      flightTrackingEnabled: Boolean(String(input.flightNumber || '').trim()),
      airline: String(input.airline || '').trim(),
      terminal: String(input.terminal || '').trim(),
      meetAndGreet: Boolean(input.meetAndGreet),
      notes: premiumNotes,
      driverName: '',
      driverPhone: '',
      driverCar: '',
      driverId: '',
      createdAt: new Date(),
      ...buildRidePaymentCreateFields({ price }),
      ...pickupFields,
      ...scheduledAtField,
      ...partnerFields,
    });

    if (!rideDoc.id) {
      return { status: 'missing_ride_id' };
    }

    if (rideMode === 'Réserver plus tard') {
      router.replace({
        pathname: '/reservation',
      });
      return { status: 'scheduled', rideId: rideDoc.id };
    }

    const priceDigits = price.replace(/\s/g, '').replace('DA', '').trim();

    router.replace({
      pathname: '/course-tracking',
      params: {
        id: rideDoc.id,
        rideId: rideDoc.id,
        service: 'Transfert aéroport',
        departure: route.departure,
        destination: route.destination,
        address: route.address,
        airport: route.airport,
        time: input.time || 'Maintenant',
        price: priceDigits || '0',
        status: 'En attente',
        mode: input.transferMode,
      },
    });

    return { status: 'tracking', rideId: rideDoc.id };
  } catch (error) {
    return { status: 'error', error };
  }
}
