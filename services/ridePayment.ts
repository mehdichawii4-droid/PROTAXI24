import { serverTimestamp, updateDoc } from 'firebase/firestore';
import { getRideDocRef } from '@/firebase/firestore';
import { devError, devLog } from '@/utils/devLog';
import { parseRidePrice } from '@/utils/rideTracking';

/** V1 enabled methods — online providers reserved for later. */
export type RidePaymentMethod = 'cash';

/** Future-ready union for reads; only cash is writable in V1. */
export type RidePaymentMethodRead = RidePaymentMethod | 'cib' | 'edahabia' | 'card' | 'stripe';

export type RidePaymentStatus = 'pending' | 'paid' | 'cancelled';

export type RidePaymentState = {
  fareAmount: number;
  paymentMethod: RidePaymentMethodRead;
  paymentStatus: RidePaymentStatus;
  paidAt?: unknown;
  confirmedByDriverId?: string;
};

export type RidePaymentCreateFields = {
  fareAmount: number;
  paymentMethod: RidePaymentMethod;
  paymentStatus: 'pending';
};

export type BuildRidePaymentCreateInput = {
  price?: unknown;
  estimatedPrice?: unknown;
  totalPrice?: unknown;
  paymentMethod?: RidePaymentMethod;
};

export class RidePaymentError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RidePaymentError';
    this.code = code;
  }
}

function normalizeRideStatus(status: unknown): string {
  const raw = String(status ?? '').trim();
  const lower = raw.toLowerCase();
  if (lower === 'terminée' || lower === 'terminee') return 'Terminée';
  return raw;
}

export function normalizeRidePaymentMethod(value: unknown): RidePaymentMethodRead {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'cib' || raw === 'edahabia' || raw === 'card' || raw === 'stripe') {
    return raw;
  }
  return 'cash';
}

export function normalizeRidePaymentStatus(value: unknown): RidePaymentStatus {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'paid') return 'paid';
  if (raw === 'cancelled' || raw === 'canceled') return 'cancelled';
  return 'pending';
}

export function normalizeRidePayment(
  ride: Record<string, unknown> | null | undefined,
): RidePaymentState {
  const data = ride ?? {};
  const fareFromDoc = Number(data.fareAmount);
  const fareAmount =
    Number.isFinite(fareFromDoc) && fareFromDoc >= 0
      ? Math.round(fareFromDoc)
      : parseRidePrice(data.price, data.estimatedPrice, data.totalPrice);

  return {
    fareAmount,
    paymentMethod: normalizeRidePaymentMethod(data.paymentMethod),
    paymentStatus: normalizeRidePaymentStatus(data.paymentStatus),
    paidAt: data.paidAt,
    confirmedByDriverId: String(data.confirmedByDriverId ?? '').trim() || undefined,
  };
}

export function buildRidePaymentCreateFields(
  input: BuildRidePaymentCreateInput = {},
): RidePaymentCreateFields {
  const fareAmount = parseRidePrice(
    input.price,
    input.estimatedPrice,
    input.totalPrice,
  );
  const paymentMethod = input.paymentMethod === 'cash' ? 'cash' : 'cash';

  return {
    fareAmount,
    paymentMethod,
    paymentStatus: 'pending',
  };
}

export function formatRidePaymentAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Sur confirmation';
  }
  return `${amount.toLocaleString('fr-FR')} DA`;
}

export function getRidePaymentMethodLabel(method: RidePaymentMethodRead): string {
  switch (method) {
    case 'cib':
      return 'CIB';
    case 'edahabia':
      return 'Edahabia';
    case 'card':
      return 'Carte bancaire';
    case 'stripe':
      return 'Carte en ligne';
    default:
      return 'Espèces';
  }
}

export function getRidePaymentStatusLabel(status: RidePaymentStatus): string {
  switch (status) {
    case 'paid':
      return 'Payé';
    case 'cancelled':
      return 'Annulé';
    default:
      return 'En attente';
  }
}

export function getRidePaymentStatusConfig(status: RidePaymentStatus) {
  switch (status) {
    case 'paid':
      return {
        label: getRidePaymentStatusLabel(status),
        badge: 'PAYÉ',
        color: '#4ADE80',
        glow: 'rgba(74,222,128,0.2)',
        border: 'rgba(74,222,128,0.4)',
      };
    case 'cancelled':
      return {
        label: getRidePaymentStatusLabel(status),
        badge: 'ANNULÉ',
        color: '#9CA3AF',
        glow: 'rgba(156,163,175,0.15)',
        border: 'rgba(156,163,175,0.35)',
      };
    default:
      return {
        label: getRidePaymentStatusLabel(status),
        badge: 'EN ATTENTE',
        color: '#D4A017',
        glow: 'rgba(212,160,23,0.18)',
        border: 'rgba(212,160,23,0.35)',
      };
  }
}

export function isRidePaymentPaid(ride: Record<string, unknown> | null | undefined): boolean {
  return normalizeRidePayment(ride).paymentStatus === 'paid';
}

export function canConfirmCashPayment(
  ride: Record<string, unknown> | null | undefined,
  driverUid?: string,
): boolean {
  if (!ride) return false;
  if (normalizeRideStatus(ride.status) !== 'Terminée') return false;

  const assignedDriverId = String(ride.driverId ?? '').trim();
  const normalizedDriverUid = String(driverUid ?? '').trim();
  if (normalizedDriverUid && assignedDriverId !== normalizedDriverUid) {
    return false;
  }

  const payment = normalizeRidePayment(ride);
  if (payment.paymentStatus !== 'pending') return false;
  return payment.paymentMethod === 'cash';
}

/** True when ride document has an explicit paymentStatus field. */
export function hasRidePaymentStatusField(
  ride: Record<string, unknown> | null | undefined,
): boolean {
  if (!ride) return false;
  return 'paymentStatus' in ride && String(ride.paymentStatus ?? '').trim() !== '';
}

/** Revenue KPI: only rides explicitly marked paid (legacy without field excluded). */
export function isRideRevenueCounted(
  ride: Record<string, unknown> | null | undefined,
): boolean {
  if (!ride || !hasRidePaymentStatusField(ride)) {
    return false;
  }
  return normalizeRidePaymentStatus(ride.paymentStatus) === 'paid';
}

export function getRideCollectedFareAmount(
  ride: Record<string, unknown> | null | undefined,
): number {
  if (!isRideRevenueCounted(ride)) {
    return 0;
  }
  return normalizeRidePayment(ride).fareAmount;
}

export async function confirmCashPayment(
  rideId: string,
  driverId: string,
): Promise<void> {
  const normalizedRideId = rideId.trim();
  const normalizedDriverId = driverId.trim();

  if (!normalizedRideId) {
    throw new RidePaymentError('ride_id_required', 'Identifiant de course requis.');
  }
  if (!normalizedDriverId) {
    throw new RidePaymentError('driver_id_required', 'Identifiant chauffeur requis.');
  }

  try {
    await updateDoc(getRideDocRef(normalizedRideId), {
      paymentStatus: 'paid',
      paidAt: serverTimestamp(),
      confirmedByDriverId: normalizedDriverId,
      updatedAt: serverTimestamp(),
    });

    devLog('[RIDE PAYMENT] cash confirmed', {
      rideId: normalizedRideId,
      driverId: normalizedDriverId,
    });
  } catch (error) {
    if (error instanceof RidePaymentError) {
      throw error;
    }

    devError('[RIDE PAYMENT] confirmCashPayment failed', {
      rideId: normalizedRideId,
      driverId: normalizedDriverId,
      error,
    });

    const code = String((error as { code?: string })?.code ?? '');
    if (code === 'permission-denied') {
      throw new RidePaymentError(
        'permission_denied',
        'Permission refusée pour confirmer le paiement.',
      );
    }

    throw error;
  }
}
