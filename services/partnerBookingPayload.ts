import { parseRidePrice } from '@/utils/rideTracking';
import type { PartnerBookingType } from '@/types/partner';

export type PartnerTransferBookingInput = {
  partnerUid: string;
  partnerName: string;
  clientName: string;
  clientPhone: string;
  pickup: string;
  destination: string;
  date: string;
  time: string;
  notes: string;
};

export const PARTNER_TRANSFER_PRICE_LABEL = 'Sur confirmation';

export function buildPartnerReservationSnapshotFields(partnerId: string, partnerName: string) {
  return {
    partnerId: partnerId.trim(),
    partnerName: partnerName.trim(),
  };
}

export function buildPartnerTransferPaymentFields(priceLabel: string = PARTNER_TRANSFER_PRICE_LABEL) {
  return {
    fareAmount: parseRidePrice(priceLabel),
    paymentMethod: 'cash' as const,
    paymentStatus: 'pending' as const,
  };
}

export function buildPartnerTransferRidePayload(input: PartnerTransferBookingInput) {
  const partnerFields = buildPartnerReservationSnapshotFields(input.partnerUid, input.partnerName);

  return {
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
    price: PARTNER_TRANSFER_PRICE_LABEL,
    status: 'En attente',
    source: 'partner',
    driverId: '',
    driverName: '',
    driverPhone: '',
    driverCar: '',
    ...buildPartnerTransferPaymentFields(PARTNER_TRANSFER_PRICE_LABEL),
    ...partnerFields,
  };
}

export type PartnerNewBookingInput = PartnerTransferBookingInput & {
  bookingType: PartnerBookingType;
};
