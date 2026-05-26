import { serverTimestamp, updateDoc } from 'firebase/firestore';
import { devError } from '@/utils/devLog';
import { getTourBookingDocRef } from '@/firebase/firestore';

export type TourCheckInStatus = 'pending' | 'checked-in';

export type TourBookingTicketFields = {
  ticketCode: string;
  checkInStatus: TourCheckInStatus;
  checkedInAt?: unknown;
};

export function normalizeTourCheckInStatus(value: unknown): TourCheckInStatus {
  if (value === 'checked-in') return 'checked-in';
  return 'pending';
}

export function slugifyExperienceForTicket(experience: string) {
  const normalized = experience
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, ' ')
    .trim();

  const knownDestinations = ['GUELMA', 'SETIF', 'ANNABA', 'ALGER', 'CONSTANTINE', 'BEJAIA'];
  const matchedDestination = knownDestinations.find((destination) =>
    normalized.includes(destination),
  );
  if (matchedDestination) return matchedDestination;

  const firstWord = normalized.split(/\s+/).filter(Boolean)[0];
  return (firstWord || 'TOUR').slice(0, 12);
}

export function generateTourTicketCode(experience: string) {
  const slug = slugifyExperienceForTicket(experience);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PRX-${slug}-${random}`;
}

export function buildTourTicketQrValue(ticketCode: string, bookingId?: string) {
  if (bookingId) {
    return `PROTAXI|TICKET|${ticketCode}|${bookingId}`;
  }
  return `PROTAXI|TICKET|${ticketCode}`;
}

export function getCheckInStatusLabel(status: TourCheckInStatus) {
  switch (status) {
    case 'checked-in':
      return 'Présence validée';
    default:
      return 'En attente de check-in';
  }
}

export function isTourBookingCheckedIn(status: TourCheckInStatus) {
  return status === 'checked-in';
}

export function formatCheckedInAt(value: unknown) {
  if (!value) return '';

  let date: Date | null = null;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'object' && value !== null && 'toDate' in value) {
    date = (value as { toDate?: () => Date }).toDate?.() ?? null;
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  }

  if (!date || Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function checkInTourBooking(bookingId: string) {
  const normalizedBookingId = bookingId.trim();
  if (!normalizedBookingId) {
    throw new Error('bookingId is required to check in a tour booking.');
  }

  try {
    await updateDoc(getTourBookingDocRef(normalizedBookingId), {
      checkInStatus: 'checked-in',
      checkedInAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    devError('[PROMISE DENIED - tourGroupTicket - checkInBooking]', error);
    throw error;
  }
}
