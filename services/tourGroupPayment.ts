import { serverTimestamp, updateDoc } from 'firebase/firestore';
import { devError } from '@/utils/devLog';
import { getTourBookingDocRef } from '@/firebase/firestore';

export type TourPaymentStatus = 'unpaid' | 'deposit-paid' | 'fully-paid';
export type TourPaymentMethod = 'cash' | 'ccp' | 'card';

export const GROUP_DEPOSIT_RATE = 0.3;

export type TourBookingPaymentFields = {
  paymentStatus: TourPaymentStatus;
  depositAmount: number;
  remainingAmount: number;
  paymentMethod: TourPaymentMethod;
};

export function parseTourPriceAmount(price?: string) {
  return parseInt(String(price || '0').replace(/\D/g, ''), 10) || 0;
}

export function calculateGroupPaymentAmounts(priceRaw: string, travelers = 1) {
  const unitPrice = parseTourPriceAmount(priceRaw);
  const totalAmount = unitPrice * Math.max(travelers, 1);
  const depositAmount = Math.round(totalAmount * GROUP_DEPOSIT_RATE);
  const remainingAmount = totalAmount - depositAmount;

  return {
    unitPrice,
    totalAmount,
    depositAmount,
    remainingAmount,
  };
}

export function formatTourPaymentAmount(amount: number) {
  if (!amount) return 'Sur devis';
  return `${amount.toLocaleString('fr-FR')} DA`;
}

export function normalizeTourPaymentStatus(value: unknown): TourPaymentStatus {
  if (value === 'deposit-paid' || value === 'fully-paid') return value;
  return 'unpaid';
}

export function normalizeTourPaymentMethod(value: unknown): TourPaymentMethod {
  if (value === 'ccp' || value === 'card') return value;
  return 'cash';
}

export function getPaymentStatusLabel(status: TourPaymentStatus) {
  switch (status) {
    case 'fully-paid':
      return 'Totalement payé';
    case 'deposit-paid':
      return 'Acompte payé';
    default:
      return 'Non payé';
  }
}

export function getPaymentMethodLabel(method: TourPaymentMethod) {
  switch (method) {
    case 'ccp':
      return 'CCP / BaridiMob';
    case 'card':
      return 'Carte bancaire';
    default:
      return 'Espèces';
  }
}

export function getPaymentProgress(status: TourPaymentStatus) {
  switch (status) {
    case 'fully-paid':
      return 100;
    case 'deposit-paid':
      return GROUP_DEPOSIT_RATE * 100;
    default:
      return 0;
  }
}

export function getPaymentStatusConfig(status: TourPaymentStatus) {
  switch (status) {
    case 'fully-paid':
      return {
        label: getPaymentStatusLabel(status),
        badge: 'PAYÉ',
        color: '#8BC53F',
        glow: 'rgba(139,197,63,0.22)',
        border: 'rgba(139,197,63,0.45)',
        progressColor: '#8BC53F',
      };
    case 'deposit-paid':
      return {
        label: getPaymentStatusLabel(status),
        badge: 'ACOMPTE',
        color: '#F59E0B',
        glow: 'rgba(245,158,11,0.18)',
        border: 'rgba(245,158,11,0.35)',
        progressColor: '#F59E0B',
      };
    default:
      return {
        label: getPaymentStatusLabel(status),
        badge: 'IMPAYÉ',
        color: '#EF4444',
        glow: 'rgba(239,68,68,0.16)',
        border: 'rgba(239,68,68,0.35)',
        progressColor: '#EF4444',
      };
  }
}

export async function markTourBookingDepositPaid(bookingId: string) {
  const normalizedBookingId = bookingId.trim();
  if (!normalizedBookingId) {
    throw new Error('bookingId is required to mark a tour booking deposit as paid.');
  }

  try {
    await updateDoc(getTourBookingDocRef(normalizedBookingId), {
      paymentStatus: 'deposit-paid',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    devError('[PROMISE DENIED - tourGroupPayment - markDepositPaid]', error);
    throw error;
  }
}

export async function markTourBookingFullyPaid(bookingId: string) {
  const normalizedBookingId = bookingId.trim();
  if (!normalizedBookingId) {
    throw new Error('bookingId is required to mark a tour booking as fully paid.');
  }

  try {
    await updateDoc(getTourBookingDocRef(normalizedBookingId), {
      paymentStatus: 'fully-paid',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    devError('[PROMISE DENIED - tourGroupPayment - markFullyPaid]', error);
    throw error;
  }
}
