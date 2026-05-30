import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { getTourBookingsCollectionRef } from '@/firebase/firestore';
import { buildPartnerReservationFields } from '@/services/partnerService';
import {
  buildPartnerTransferRidePayload,
  type PartnerNewBookingInput,
} from '@/services/partnerBookingPayload';
import { devError, devLog } from '@/utils/devLog';

export type { PartnerNewBookingInput } from '@/services/partnerBookingPayload';
export {
  buildPartnerTransferRidePayload,
  PARTNER_TRANSFER_PRICE_LABEL,
} from '@/services/partnerBookingPayload';

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
      ...buildPartnerTransferRidePayload(input),
      createdAt: now,
      updatedAt: now,
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
