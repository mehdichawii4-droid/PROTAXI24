import type { PartnerFieldError, PartnerFormInput } from '@/types/partner';
import type { HotelPartnerProfileFormValues } from '@/types/partnerProfileForm';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const HOTEL_DESCRIPTION_MIN_LENGTH = 30;
export const HOTEL_DESCRIPTION_MAX_LENGTH = 500;

export function getHotelPartnerProfileFieldError(
  errors: PartnerFieldError[],
  field: string,
): string | undefined {
  return errors.find((item) => item.field === field)?.message;
}

export function validateHotelDescription(description: string | undefined): PartnerFieldError[] {
  const normalized = String(description || '').trim();
  const errors: PartnerFieldError[] = [];

  if (!normalized) {
    errors.push({ field: 'description', message: 'Description de l\'établissement requise.' });
    return errors;
  }

  if (normalized.length < HOTEL_DESCRIPTION_MIN_LENGTH) {
    errors.push({
      field: 'description',
      message: `La description doit contenir au moins ${HOTEL_DESCRIPTION_MIN_LENGTH} caractères.`,
    });
  } else if (normalized.length > HOTEL_DESCRIPTION_MAX_LENGTH) {
    errors.push({
      field: 'description',
      message: `La description ne doit pas dépasser ${HOTEL_DESCRIPTION_MAX_LENGTH} caractères.`,
    });
  }

  return errors;
}

export function validateHotelWebsite(website: string): PartnerFieldError[] {
  const trimmed = website.trim();
  if (!trimmed) {
    return [];
  }

  if (!trimmed.includes('.')) {
    return [{ field: 'website', message: 'URL du site web invalide.' }];
  }

  return [];
}

/** Validation UI alignée partnerCoreService (sans I/O). */
export function validateHotelPartnerProfileFormValues(
  values: HotelPartnerProfileFormValues,
): PartnerFieldError[] {
  const errors: PartnerFieldError[] = [];

  if (!values.companyName.trim()) {
    errors.push({ field: 'companyName', message: 'Nom de l\'établissement requis.' });
  }

  if (!values.contactName.trim()) {
    errors.push({ field: 'contactName', message: 'Contact principal requis.' });
  }

  if (!values.phone.trim()) {
    errors.push({ field: 'phone', message: 'Téléphone requis.' });
  }

  const email = values.email.trim().toLowerCase();
  if (!email) {
    errors.push({ field: 'email', message: 'Email requis.' });
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.push({ field: 'email', message: 'Adresse email invalide.' });
  }

  if (!values.address.trim()) {
    errors.push({ field: 'address', message: 'Adresse requise.' });
  }

  if (!values.city.trim()) {
    errors.push({ field: 'city', message: 'Ville requise.' });
  }

  errors.push(...validateHotelDescription(values.description));
  errors.push(...validateHotelWebsite(values.website));

  return errors;
}

export function isHotelPartnerProfileFormValid(values: HotelPartnerProfileFormValues): boolean {
  return validateHotelPartnerProfileFormValues(values).length === 0;
}

/** Mappe le formulaire hôtel vers PartnerFormInput (inscription / self-service). */
export function hotelPartnerFormValuesToPartnerInput(
  partnerUid: string,
  values: HotelPartnerProfileFormValues,
  email: string,
): PartnerFormInput {
  return {
    partnerUid: partnerUid.trim(),
    companyName: values.companyName.trim(),
    partnerType: 'hotel',
    contactName: values.contactName.trim(),
    phone: values.phone.trim(),
    email: email.trim().toLowerCase(),
    description: values.description.trim(),
    address: values.address.trim(),
    city: values.city.trim(),
    website: values.website.trim() || undefined,
  };
}
