import {
  getCheckInStatusLabel,
  normalizeTourCheckInStatus,
} from '@/services/tourGroupTicket';
import {
  getPaymentStatusLabel,
  normalizeTourPaymentStatus,
} from '@/services/tourGroupPayment';

export type TourBookingRecord = {
  id: string;
  clientUid?: string;
  experience?: string;
  circuitName?: string;
  formula?: string;
  bookingMode?: string;
  duration?: string;
  steps?: string;
  options?: string;
  travelers?: string;
  date?: string;
  meetingPoint?: string;
  notes?: string;
  price?: string;
  groupDeparture?: string;
  groupMeetingPoint?: string;
  groupSpotsLeft?: string;
  groupTravelers?: string;
  groupId?: string;
  ticketCode?: string;
  checkInStatus?: string;
  paymentStatus?: string;
  status?: string;
  source?: string;
  createdAt?: unknown;
  assignedGuideId?: string;
  assignedGuideName?: string;
  assignedGuidePhone?: string;
  assignedGuideSpecialtiesSummary?: string;
};

export function normalizeTourBookingRecord(
  id: string,
  raw: Record<string, unknown>,
): TourBookingRecord {
  return {
    id,
    clientUid: raw.clientUid ? String(raw.clientUid) : undefined,
    experience: String(raw.experience || raw.circuitName || 'Expérience PROTAXI'),
    circuitName: String(raw.circuitName || raw.experience || ''),
    formula: String(raw.formula || ''),
    bookingMode: String(raw.bookingMode || 'private'),
    duration: String(raw.duration || ''),
    steps: String(raw.steps || ''),
    options: String(raw.options || ''),
    travelers: String(raw.travelers || '1'),
    date: String(raw.date || 'À confirmer'),
    meetingPoint: String(raw.meetingPoint || ''),
    notes: String(raw.notes || ''),
    price: String(raw.price || 'Sur devis'),
    groupDeparture: String(raw.groupDeparture || ''),
    groupMeetingPoint: String(raw.groupMeetingPoint || ''),
    groupSpotsLeft: String(raw.groupSpotsLeft || ''),
    groupTravelers: String(raw.groupTravelers || ''),
    groupId: String(raw.groupId || ''),
    ticketCode: String(raw.ticketCode || ''),
    checkInStatus: String(raw.checkInStatus || ''),
    paymentStatus: String(raw.paymentStatus || ''),
    status: String(raw.status || 'pending'),
    source: String(raw.source || 'discover-guelma'),
    createdAt: raw.createdAt,
    assignedGuideId: raw.assignedGuideId ? String(raw.assignedGuideId) : undefined,
    assignedGuideName: raw.assignedGuideName ? String(raw.assignedGuideName) : undefined,
    assignedGuidePhone: raw.assignedGuidePhone ? String(raw.assignedGuidePhone) : undefined,
    assignedGuideSpecialtiesSummary: raw.assignedGuideSpecialtiesSummary
      ? String(raw.assignedGuideSpecialtiesSummary)
      : undefined,
  };
}

export function isGroupTourBooking(booking: TourBookingRecord) {
  return booking.bookingMode === 'group';
}

export function getTourBookingModeLabel(mode?: string) {
  return mode === 'group' ? 'Expérience groupe' : 'Expérience privée';
}

/** Prix tourisme affichés client / admin (Sur devis, Sur confirmation, DA). */
export function formatTourDisplayPrice(price?: string) {
  if (!price?.trim()) return '—';
  const normalized = price.trim();
  if (
    normalized.includes('DA') ||
    normalized === 'Sur devis' ||
    normalized === 'Sur confirmation'
  ) {
    return normalized;
  }
  const amount = parseInt(String(normalized).replace(/\D/g, ''), 10);
  if (!amount) return normalized;
  return `${amount.toLocaleString('fr-FR')} DA`;
}

export function formatTourHistoryPrice(price?: string) {
  return formatTourDisplayPrice(price);
}

export function getTourBookingSourceLabel(source?: string) {
  if (source === 'experiences-private') return 'Expériences privées';
  if (source === 'discover-guelma') return 'Discover Guelma';
  return source?.trim() || '—';
}

export function getTourBookingStatusConfig(status?: string) {
  switch (status) {
    case 'confirmed':
      return { label: 'Confirmée', color: '#8BC53F', bg: 'rgba(139,197,63,0.18)', border: 'rgba(139,197,63,0.35)' };
    case 'cancelled':
      return { label: 'Annulée', color: '#EF4444', bg: 'rgba(239,68,68,0.18)', border: 'rgba(239,68,68,0.35)' };
    case 'pending':
    default:
      return { label: 'En attente', color: '#F59E0B', bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.35)' };
  }
}

export function getTourBookingCreatedAtLabel(value: unknown) {
  if (!value) return '—';

  let date: Date | null = null;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'object' && value !== null && 'toDate' in value) {
    date = (value as { toDate?: () => Date }).toDate?.() ?? null;
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  }

  if (!date || Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildTourSummaryParams(booking: TourBookingRecord): Record<string, string> {
  const params: Record<string, string> = {
    experience: booking.experience || booking.circuitName || 'Expérience PROTAXI',
    duration: booking.duration || 'Flexible',
    steps: booking.steps || '',
    options: booking.options || '',
    travelers: booking.travelers || '1',
    date: booking.date || 'À confirmer',
    meetingPoint: booking.meetingPoint || 'Non renseigné',
    notes: booking.notes || 'Aucune note',
    price:
      booking.price ||
      (booking.source === 'experiences-private' ? 'Sur confirmation' : 'Sur devis'),
    circuitName: booking.circuitName || booking.experience || '',
    source: booking.source || 'discover-guelma',
    bookingMode: booking.bookingMode || 'private',
    tourBookingId: booking.id,
  };

  if (booking.formula) {
    params.formula = booking.formula;
  }

  if (isGroupTourBooking(booking)) {
    params.groupDeparture = booking.groupDeparture || '';
    params.groupSpotsLeft = booking.groupSpotsLeft || '';
    params.groupTravelers = booking.groupTravelers || '';
    params.groupMeetingPoint = booking.groupMeetingPoint || '';
    if (booking.groupId) {
      params.groupId = booking.groupId;
    }
  }

  return params;
}

export function getTourPaymentStatusLabel(booking: TourBookingRecord) {
  if (!isGroupTourBooking(booking)) return '';
  return getPaymentStatusLabel(normalizeTourPaymentStatus(booking.paymentStatus));
}

export function getTourCheckInStatusLabel(booking: TourBookingRecord) {
  if (!isGroupTourBooking(booking)) return '';
  return getCheckInStatusLabel(normalizeTourCheckInStatus(booking.checkInStatus));
}
