import type { TourBookingRecord } from '@/services/tourBookingHistory';

export type ClientAssignedGuideDisplay = {
  assignedGuideId: string;
  assignedGuideName: string;
  assignedGuidePhone?: string;
  assignedGuideSpecialtiesSummary?: string;
};

function normalizeOptionalString(value: unknown): string | undefined {
  const text = String(value ?? '').trim();
  return text || undefined;
}

export function parseClientAssignedGuide(
  raw: Record<string, unknown> | TourBookingRecord,
): ClientAssignedGuideDisplay | null {
  const assignedGuideId = normalizeOptionalString(
    'assignedGuideId' in raw ? raw.assignedGuideId : undefined,
  );
  const assignedGuideName = normalizeOptionalString(
    'assignedGuideName' in raw ? raw.assignedGuideName : undefined,
  );

  if (!assignedGuideId || !assignedGuideName) return null;

  return {
    assignedGuideId,
    assignedGuideName,
    assignedGuidePhone: normalizeOptionalString(
      'assignedGuidePhone' in raw ? raw.assignedGuidePhone : undefined,
    ),
    assignedGuideSpecialtiesSummary: normalizeOptionalString(
      'assignedGuideSpecialtiesSummary' in raw ? raw.assignedGuideSpecialtiesSummary : undefined,
    ),
  };
}

/** Carte guide client : expériences privées, guide assigné, réservation non annulée. */
export function shouldShowClientAssignedGuide(
  booking: Pick<TourBookingRecord, 'source' | 'status'> & Record<string, unknown>,
): boolean {
  if (booking.source !== 'experiences-private') return false;
  if (booking.status === 'cancelled') return false;
  return parseClientAssignedGuide(booking) !== null;
}

export function normalizePhoneForDial(phone?: string): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  return digits || null;
}
