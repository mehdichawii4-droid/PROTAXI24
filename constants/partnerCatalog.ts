import type { PartnerStatus, PartnerType } from '@/firebase/types';

export const PARTNER_STATUSES: readonly PartnerStatus[] = [
  'draft',
  'pending_review',
  'active',
  'suspended',
] as const;

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  draft: 'Brouillon',
  pending_review: 'En attente de validation',
  active: 'Actif',
  suspended: 'Suspendu',
};

export const PARTNER_TYPES: readonly PartnerType[] = ['hotel', 'agency', 'transport'] as const;

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  hotel: 'Hôtel',
  agency: 'Agence',
  transport: 'Transport',
};

const PARTNER_STATUS_SET = new Set<string>(PARTNER_STATUSES);
const PARTNER_TYPE_SET = new Set<string>(PARTNER_TYPES);

export function isPartnerStatus(value: string): value is PartnerStatus {
  return PARTNER_STATUS_SET.has(value);
}

export function isPartnerType(value: string): value is PartnerType {
  return PARTNER_TYPE_SET.has(value);
}
