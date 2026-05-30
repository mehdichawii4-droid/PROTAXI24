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
