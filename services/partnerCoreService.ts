import {
  PARTNER_STATUS_LABELS,
  PARTNER_TYPE_LABELS,
  isPartnerStatus,
  isPartnerType,
} from '@/constants/partnerCatalog';
import type { Partner, PartnerStatus, PartnerType } from '@/firebase/types';
import type {
  PartnerFieldError,
  PartnerFormInput,
  PartnerSelfProfile,
  PartnerValidationResult,
} from '@/types/partner';
import { PartnerServiceError } from '@/types/partner';
import { validateHotelDescription } from '@/utils/partnerProfileFormValidation';

const ALLOWED_CREATE_STATUSES: PartnerStatus[] = ['draft', 'pending_review'];
const SELF_EDITABLE_STATUSES: PartnerStatus[] = ['draft', 'pending_review'];

const STATUS_TRANSITIONS: Record<PartnerStatus, PartnerStatus[]> = {
  draft: ['pending_review'],
  pending_review: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getPartnerStatusLabel(status: PartnerStatus): string {
  return PARTNER_STATUS_LABELS[status] ?? status;
}

export function isPartnerEditable(status: PartnerStatus): boolean {
  return SELF_EDITABLE_STATUSES.includes(status);
}

/**
 * Compte actif pour réservations / isPartnerActive (règles Firestore Lot 1).
 * Legacy sans status : isActive fait foi.
 */
export function isPartnerActiveStatus(
  status: PartnerStatus | undefined,
  isActive: boolean,
): boolean {
  if (!status) {
    return isActive !== false;
  }

  return status === 'active' && isActive !== false;
}

export function resolveIsActiveForStatus(status: PartnerStatus): boolean {
  return status === 'active';
}

export function assertPartnerStatusTransition(from: PartnerStatus, to: PartnerStatus): void {
  if (from === to) return;

  const allowed = STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new PartnerServiceError(
      'PARTNER_STATUS_TRANSITION_INVALID',
      `Transition de statut impossible : ${from} → ${to}.`,
    );
  }
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizePartnerType(value: unknown): PartnerType {
  const raw = String(value || '').trim();
  if (isPartnerType(raw)) return raw;
  return 'hotel';
}

function normalizePartnerStatusFromData(
  data: Record<string, unknown>,
  isActive: boolean,
): PartnerStatus {
  if ('status' in data) {
    const raw = String(data.status || '').trim();
    if (isPartnerStatus(raw)) return raw;
  }

  return isActive === false ? 'suspended' : 'active';
}

export function normalizePartnerProfile(
  partnerId: string,
  data: Record<string, unknown>,
): Partner | null {
  const uid = partnerId.trim();
  if (!uid) return null;

  const isActive = Boolean(data.isActive ?? true);
  const status = normalizePartnerStatusFromData(data, isActive);

  return {
    uid,
    companyName: String(data.companyName || data.fullName || '').trim(),
    partnerType: normalizePartnerType(data.partnerType),
    contactName: String(data.contactName || data.fullName || '').trim(),
    phone: String(data.phone || '').trim(),
    email: String(data.email || '').trim().toLowerCase(),
    isActive,
    status,
    description: String(data.description || '').trim(),
    address: normalizeOptionalString(data.address),
    city: normalizeOptionalString(data.city),
    postalCode: normalizeOptionalString(data.postalCode),
    receptionPhone: normalizeOptionalString(data.receptionPhone),
    website: normalizeOptionalString(data.website),
    validatedAt: (data.validatedAt as Partner['validatedAt']) ?? undefined,
    validatedBy: normalizeOptionalString(data.validatedBy),
    internalNotes: normalizeOptionalString(data.internalNotes),
    createdAt: (data.createdAt as Partner['createdAt']) ?? new Date(),
    updatedAt: (data.updatedAt as Partner['updatedAt']) ?? new Date(),
  };
}

function validateOptionalUrlField(field: string, value?: string): PartnerFieldError[] {
  if (!value?.trim()) return [];
  const trimmed = value.trim();
  if (trimmed.length > 0 && !trimmed.includes('.')) {
    return [{ field, message: 'URL invalide.' }];
  }
  return [];
}

export function validatePartnerInput(
  input: PartnerFormInput,
  mode: 'create' | 'update',
  options?: { hotelSelf?: boolean },
): PartnerValidationResult {
  const errors: PartnerFieldError[] = [];

  if (!input.partnerUid.trim()) {
    errors.push({ field: 'partnerUid', message: 'Identifiant partenaire (uid Auth) requis.' });
  }

  if (!input.companyName.trim()) {
    errors.push({ field: 'companyName', message: 'Nom de l\'établissement requis.' });
  }

  if (!input.contactName.trim()) {
    errors.push({ field: 'contactName', message: 'Nom du contact requis.' });
  }

  if (!input.phone.trim()) {
    errors.push({ field: 'phone', message: 'Téléphone requis.' });
  }

  const email = input.email.trim().toLowerCase();
  if (!email) {
    errors.push({ field: 'email', message: 'Email requis.' });
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.push({ field: 'email', message: 'Adresse email invalide.' });
  }

  if (!isPartnerType(input.partnerType)) {
    errors.push({ field: 'partnerType', message: 'Type de partenaire invalide.' });
  }

  if (options?.hotelSelf && input.partnerType !== 'hotel') {
    errors.push({
      field: 'partnerType',
      message: 'L\'auto-inscription est réservée aux établissements hôteliers.',
    });
  }

  if (options?.hotelSelf) {
    errors.push(...validateHotelDescription(input.description));
  }

  errors.push(...validateOptionalUrlField('website', input.website));

  if (mode === 'create' && input.status && !ALLOWED_CREATE_STATUSES.includes(input.status)) {
    errors.push({
      field: 'status',
      message: 'Statut initial autorisé : brouillon ou en attente de validation.',
    });
  }

  if (options?.hotelSelf && mode === 'create' && input.status && input.status !== 'pending_review') {
    errors.push({
      field: 'status',
      message: 'L\'inscription hôtel doit créer un dossier en attente de validation.',
    });
  }

  return { ok: errors.length === 0, errors };
}

export type BuildPartnerFirestorePayloadOptions = {
  status: PartnerStatus;
  isActive?: boolean;
  validatedAt?: unknown;
  validatedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export function buildPartnerFirestorePayload(
  input: PartnerFormInput,
  options: BuildPartnerFirestorePayloadOptions,
): Record<string, unknown> {
  const status = options.status;
  const isActive = options.isActive ?? resolveIsActiveForStatus(status);

  const payload: Record<string, unknown> = {
    uid: input.partnerUid.trim(),
    companyName: input.companyName.trim(),
    partnerType: input.partnerType,
    contactName: input.contactName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    status,
    isActive,
    description: input.description.trim(),
    updatedAt: options.updatedAt,
    createdAt: options.createdAt,
  };

  const address = input.address?.trim();
  if (address) payload.address = address;

  const city = input.city?.trim();
  if (city) payload.city = city;

  const postalCode = input.postalCode?.trim();
  if (postalCode) payload.postalCode = postalCode;

  const receptionPhone = input.receptionPhone?.trim();
  if (receptionPhone) payload.receptionPhone = receptionPhone;

  const website = input.website?.trim();
  if (website) payload.website = website;

  if (input.internalNotes?.trim()) {
    payload.internalNotes = input.internalNotes.trim();
  }

  if (status === 'active') {
    if (options.validatedAt !== undefined) payload.validatedAt = options.validatedAt;
    if (options.validatedBy) payload.validatedBy = options.validatedBy;
  } else if (options.validatedAt !== undefined || options.validatedBy) {
    if (options.validatedAt !== undefined) payload.validatedAt = options.validatedAt;
    if (options.validatedBy) payload.validatedBy = options.validatedBy;
  }

  return payload;
}

export function partnerFormInputFromPartner(partner: Partner): PartnerFormInput {
  return {
    partnerUid: partner.uid,
    companyName: partner.companyName,
    partnerType: partner.partnerType,
    contactName: partner.contactName,
    phone: partner.phone,
    email: partner.email,
    description: partner.description,
    address: partner.address,
    city: partner.city,
    postalCode: partner.postalCode,
    receptionPhone: partner.receptionPhone,
    website: partner.website,
    internalNotes: partner.internalNotes,
    status: partner.status,
  };
}

export function mapPartnerToSelfProfile(partner: Partner): PartnerSelfProfile {
  return {
    uid: partner.uid,
    companyName: partner.companyName,
    partnerType: partner.partnerType,
    partnerTypeLabel: PARTNER_TYPE_LABELS[partner.partnerType],
    contactName: partner.contactName,
    phone: partner.phone,
    email: partner.email,
    status: partner.status,
    statusLabel: getPartnerStatusLabel(partner.status),
    isActive: partner.isActive,
    description: partner.description,
    address: partner.address,
    city: partner.city,
    postalCode: partner.postalCode,
    receptionPhone: partner.receptionPhone,
    website: partner.website,
    createdAt: partner.createdAt,
    updatedAt: partner.updatedAt,
    validatedAt: partner.validatedAt,
  };
}

export function wrapPartnerFirestoreError(
  error: unknown,
  fallbackCode: PartnerServiceError['code'],
): never {
  if (error instanceof PartnerServiceError) {
    throw error;
  }

  const code =
    error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied'
      ? 'FIRESTORE_PERMISSION_DENIED'
      : fallbackCode;

  const message =
    code === 'FIRESTORE_PERMISSION_DENIED'
      ? 'Droits Firestore insuffisants pour cette opération partenaire.'
      : error instanceof Error
        ? error.message
        : 'Opération partenaire impossible.';

  throw new PartnerServiceError(code, message, { cause: error });
}
