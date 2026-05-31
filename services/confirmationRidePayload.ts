export function normalizeConfirmationParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? '';
  return String(value ?? '').trim();
}

export type ConfirmationLocationParams = {
  departure?: string | string[];
  destination?: string | string[];
  address?: string | string[];
  airport?: string | string[];
};

export function resolveConfirmationLocations(params: ConfirmationLocationParams) {
  const departureRaw = normalizeConfirmationParam(params.departure);
  const addressRaw = normalizeConfirmationParam(params.address);
  const destinationRaw = normalizeConfirmationParam(params.destination);
  const airportRaw = normalizeConfirmationParam(params.airport);

  const departure = departureRaw || addressRaw || 'À confirmer';
  const destination = destinationRaw || airportRaw || 'À confirmer';

  return { departure, destination };
}

export type ConfirmationContactParams = {
  fullName?: string | string[];
  phone?: string | string[];
};

export type ConfirmationProfileContext = {
  fullName?: string | null;
  phone?: string | null;
};

export function resolveConfirmationContact(
  params: ConfirmationContactParams,
  profile?: ConfirmationProfileContext | null,
) {
  const paramName = normalizeConfirmationParam(params.fullName);
  const paramPhone = normalizeConfirmationParam(params.phone);
  const profileName = String(profile?.fullName ?? '').trim();
  const profilePhone = String(profile?.phone ?? '').trim();

  return {
    clientName: paramName || profileName || 'Client PROTAXI',
    clientPhone: paramPhone || profilePhone || 'Non renseigné',
  };
}

function normalizeServiceKey(service: string) {
  return service
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function resolveConfirmationServiceLabel(service?: string | string[]) {
  const raw = normalizeConfirmationParam(service);
  return raw || 'Mobilité PROTAXI';
}

export function isConfirmationCityService(service?: string | string[]) {
  const key = normalizeServiceKey(normalizeConfirmationParam(service));
  return key.includes('ville') || key.includes('24h');
}

export function isConfirmationAirportService(service?: string | string[]) {
  const key = normalizeServiceKey(normalizeConfirmationParam(service));
  return key.includes('aeroport') || key.includes('airport');
}

export function isConfirmationHotelService(service?: string | string[]) {
  const key = normalizeServiceKey(normalizeConfirmationParam(service));
  return key.includes('hotel') || key.includes('sejour');
}

export function isConfirmationLongDistanceService(service?: string | string[]) {
  const key = normalizeServiceKey(normalizeConfirmationParam(service));
  return key.includes('prise en charge');
}

export type ConfirmationDisplayParams = {
  service?: string | string[];
  mode?: string | string[];
  tripType?: string | string[];
  rideMode?: string | string[];
  notes?: string | string[];
};

export function resolveConfirmationAirportModeLabel(mode?: string | string[]) {
  const raw = normalizeConfirmationParam(mode);
  if (raw === 'deposer') return 'Déposer à l’aéroport';
  if (raw === 'recuperer') return 'Récupérer à l’aéroport';
  return '';
}

export function shouldShowConfirmationAirportType(params: ConfirmationDisplayParams) {
  if (!isConfirmationAirportService(params.service)) return false;
  return Boolean(resolveConfirmationAirportModeLabel(params.mode));
}

export function shouldShowConfirmationTripType(params: ConfirmationDisplayParams) {
  if (isConfirmationCityService(params.service)) return false;
  const trip = normalizeConfirmationParam(params.tripType);
  if (!trip) return false;
  return (
    isConfirmationAirportService(params.service) ||
    isConfirmationHotelService(params.service) ||
    isConfirmationLongDistanceService(params.service)
  );
}

export function resolveConfirmationTripTypeLabel(tripType?: string | string[]) {
  const trip = normalizeConfirmationParam(tripType);
  if (trip === 'aller-retour' || trip === 'retour' || trip === 'round-trip') {
    return 'Aller-retour';
  }
  if (trip === 'simple' || trip === 'aller-simple') return 'Aller simple';
  return trip;
}

export function isConfirmationRoundTrip(tripType?: string | string[]) {
  const trip = normalizeConfirmationParam(tripType);
  return trip === 'aller-retour' || trip === 'retour' || trip === 'round-trip';
}

export function shouldShowConfirmationRideMode(params: ConfirmationDisplayParams) {
  return Boolean(normalizeConfirmationParam(params.rideMode));
}

export function shouldShowConfirmationNotes(params: ConfirmationDisplayParams) {
  const notes = normalizeConfirmationParam(params.notes);
  return Boolean(notes && notes !== 'Aucune note');
}

export function formatConfirmationPriceDisplay(
  price: string | string[] | undefined,
  finalPrice: number,
) {
  const raw = normalizeConfirmationParam(price);
  if (
    raw &&
    (raw.toLowerCase().includes('sur devis') ||
      raw.toLowerCase().includes('sur confirmation') ||
      raw.toLowerCase().includes('devis'))
  ) {
    return raw;
  }
  if (finalPrice > 0) {
    return `${finalPrice.toLocaleString('fr-FR')} DZD`;
  }
  return raw || 'Sur confirmation';
}

export function buildConfirmationWhatsAppMessage(input: {
  serviceLabel: string;
  departure: string;
  destination: string;
  date: string;
  time: string;
  passengers: string;
  bags: string;
  clientName: string;
  clientPhone: string;
  priceDisplay: string;
  airportModeLabel: string;
  tripTypeLabel: string;
  rideMode: string;
  showAirportType: boolean;
  showTripType: boolean;
  showRideMode: boolean;
  showRoundTripDiscount: boolean;
}) {
  const lines = [
    'Bonjour PROTAXI, je souhaite confirmer ma demande.',
    '',
    `Service : ${input.serviceLabel}`,
  ];

  if (input.showAirportType && input.airportModeLabel) {
    lines.push(`Type : ${input.airportModeLabel}`);
  }

  if (input.showRideMode && input.rideMode) {
    lines.push(`Mode : ${input.rideMode}`);
  }

  lines.push(
    `Départ : ${input.departure}`,
    `Destination : ${input.destination}`,
    `Date : ${input.date}`,
    `Heure : ${input.time}`,
    `Passagers : ${input.passengers}`,
    `Bagages : ${input.bags}`,
    `Contact : ${input.clientName} · ${input.clientPhone}`,
  );

  if (input.showTripType && input.tripTypeLabel) {
    lines.push(`Trajet : ${input.tripTypeLabel}`);
  }

  if (input.showRoundTripDiscount) {
    lines.push('Réduction aller-retour : -5 %');
  }

  lines.push(`Prix estimé : ${input.priceDisplay}`);

  return lines.join('\n');
}
