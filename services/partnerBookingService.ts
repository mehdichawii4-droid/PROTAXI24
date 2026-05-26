import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { getTourBookingsCollectionRef } from '@/firebase/firestore';
import { buildPartnerReservationFields } from '@/services/partnerService';
import type { PartnerBookingType } from '@/types/partner';
import { devError, devLog } from '@/utils/devLog';

export type PartnerNewBookingInput = {
  partnerUid: string;
  partnerName: string;
  clientName: string;
  clientPhone: string;
  pickup: string;
  destination: string;
  date: string;
  time: string;
  bookingType: PartnerBookingType;
  notes: string;
};

export async function createPartnerBooking(input: PartnerNewBookingInput) {
  const partnerFields = buildPartnerReservationFields(input.partnerUid, input.partnerName);
  const now = serverTimestamp();

  devLog('[PARTNER BOOKING] submit', {
    bookingType: input.bookingType,
    partnerId: input.partnerUid,
    partnerName: input.partnerName,
    clientName: input.clientName,
  });

  if (input.bookingType === 'transfer') {
    const docRef = await addDoc(collection(db, 'rides'), {
      clientUid: input.partnerUid,
      clientName: input.clientName,
      client: input.clientName,
      phone: input.clientPhone,
      clientPhone: input.clientPhone,
      service: 'Transfert partenaire',
      departure: input.pickup,
      destination: input.destination,
      address: input.pickup,
      date: input.date,
      time: input.time,
      notes: input.notes,
      status: 'En attente',
      source: 'partner',
      driverId: '',
      driverName: '',
      driverPhone: '',
      driverCar: '',
      createdAt: now,
      updatedAt: now,
      ...partnerFields,
    });

    devLog('[PARTNER BOOKING] ride created', { rideId: docRef.id });
    return { id: docRef.id, collection: 'rides' as const };
  }

  const docRef = await addDoc(getTourBookingsCollectionRef(), {
    clientUid: input.partnerUid,
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    experience: input.destination,
    circuitName: input.destination,
    meetingPoint: input.pickup,
    date: input.date,
    time: input.time,
    notes: input.notes,
    bookingMode: 'private',
    status: 'pending',
    source: 'partner',
    createdAt: now,
    updatedAt: now,
    ...partnerFields,
  });

  devLog('[PARTNER BOOKING] tourBooking created', { bookingId: docRef.id });
  return { id: docRef.id, collection: 'tourBookings' as const };
}

export function getPartnerBookingErrorMessage(error: unknown) {
  devError('[PARTNER BOOKING] create failed', error);
  return 'Impossible de créer la réservation. Vérifiez les champs et réessayez.';
}
