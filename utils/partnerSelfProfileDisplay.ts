import { isPartnerEditable } from '@/services/partnerCoreService';
import type { PartnerFormInput } from '@/types/partner';
import type { PartnerSelfProfile } from '@/types/partner';
import type { PartnerStatus } from '@/firebase/types';
import type { HotelPartnerProfileFormValues } from '@/types/partnerProfileForm';
import { hotelPartnerFormValuesToPartnerInput } from '@/utils/partnerProfileFormValidation';

export function formatPartnerTimestamp(value: unknown): string {
  if (!value) return '—';
  let date: Date | null = null;
  if (value instanceof Date) date = value;
  else if (typeof value === 'object' && value !== null && 'toDate' in value) {
    date = (value as { toDate?: () => Date }).toDate?.() ?? null;
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

export function formatShortDescription(description: string, maxLength = 120): string {
  const normalized = description.trim();
  if (!normalized) return '—';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}…`;
}

export function selfProfileToFormValues(profile: PartnerSelfProfile): HotelPartnerProfileFormValues {
  return {
    companyName: profile.companyName,
    contactName: profile.contactName,
    phone: profile.phone,
    email: profile.email,
    address: profile.address ?? '',
    city: profile.city ?? '',
    description: profile.description,
    website: profile.website ?? '',
  };
}

export function buildPartnerInputFromSelfProfile(
  profile: PartnerSelfProfile,
  form: HotelPartnerProfileFormValues,
): PartnerFormInput {
  return hotelPartnerFormValuesToPartnerInput(
    profile.uid,
    {
      ...form,
      companyName: form.companyName.trim() || profile.companyName,
      email: profile.email,
    },
    profile.email,
  );
}

export function isPartnerProfileEditable(status: PartnerStatus): boolean {
  return isPartnerEditable(status);
}

export function isPartnerOperational(status: PartnerStatus): boolean {
  return status === 'active';
}
