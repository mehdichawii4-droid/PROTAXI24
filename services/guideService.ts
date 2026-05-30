import {
  GUIDE_STATUS_LABELS,
  GUIDE_YEARS_EXPERIENCE_OPTIONS,
  CIRCUIT_NAME_TO_EXPERIENCE_ID,
  getGuideSpecialtyLabel,
  isGuideExperienceId,
  isGuideSpecialty,
  isGuideStatus,
} from '@/constants/guideCatalog';
import type {
  Guide,
  GuideExperienceId,
  GuideSpecialty,
  GuideStatus,
  GuideYearsExperience,
} from '@/firebase/types';
import type {
  AdminGuideDetail,
  AdminGuideListItem,
  AssignableGuideOption,
  GuideFieldError,
  GuideFormInput,
  GuideValidationResult,
} from '@/types/guide';
import { GuideServiceError } from '@/types/guide';

const EXPERIENCES_PRIVATE_SOURCE = 'experiences-private';
const BIO_MIN_LENGTH = 50;
const BIO_MAX_LENGTH = 300;

const ALLOWED_CREATE_STATUSES: GuideStatus[] = ['draft', 'pending_review'];

const STATUS_TRANSITIONS: Record<GuideStatus, GuideStatus[]> = {
  draft: ['pending_review'],
  pending_review: ['active', 'suspended'],
  active: ['suspended'],
  suspended: ['active'],
};

export function getGuideStatusLabel(status: GuideStatus): string {
  return GUIDE_STATUS_LABELS[status] ?? status;
}

export function isGuideAssignable(status: GuideStatus): boolean {
  return status === 'active';
}

export function isGuideRequestedOnBooking(raw: Record<string, unknown>): boolean {
  return raw.guideRequested === true;
}

export function formatGuideSpecialtiesSummary(specialties: GuideSpecialty[]): string {
  if (!specialties.length) return '—';
  return specialties.map((id) => getGuideSpecialtyLabel(id)).join(', ');
}

export function resolveExperienceIdFromBooking(
  circuitName?: string,
  experience?: string,
): GuideExperienceId | null {
  const candidates = [circuitName, experience]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  for (const title of candidates) {
    const mapped = CIRCUIT_NAME_TO_EXPERIENCE_ID[title];
    if (mapped) return mapped;
  }

  return null;
}

export function getCircuitNameForExperienceId(experienceId: GuideExperienceId): string | null {
  const entry = Object.entries(CIRCUIT_NAME_TO_EXPERIENCE_ID).find(([, id]) => id === experienceId);
  return entry?.[0] ?? null;
}

export function canGuideServeExperience(
  guide: Pick<Guide, 'status' | 'allowedExperienceIds'>,
  experienceId: GuideExperienceId,
): boolean {
  return isGuideAssignable(guide.status) && guide.allowedExperienceIds.includes(experienceId);
}

export function assertGuideStatusTransition(from: GuideStatus, to: GuideStatus): void {
  if (from === to) return;

  const allowed = STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new GuideServiceError(
      'GUIDE_STATUS_TRANSITION_INVALID',
      `Transition de statut impossible : ${from} → ${to}.`,
    );
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function normalizeSpecialties(value: unknown): GuideSpecialty[] {
  const seen = new Set<string>();
  const result: GuideSpecialty[] = [];

  for (const item of normalizeStringArray(value)) {
    if (!isGuideSpecialty(item) || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }

  return result;
}

function normalizeAllowedExperienceIds(value: unknown): GuideExperienceId[] {
  const seen = new Set<string>();
  const result: GuideExperienceId[] = [];

  for (const item of normalizeStringArray(value)) {
    if (!isGuideExperienceId(item) || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }

  return result;
}

function normalizeYearsExperience(value: unknown): GuideYearsExperience {
  const raw = String(value || '').trim();
  if (GUIDE_YEARS_EXPERIENCE_OPTIONS.some((item) => item.id === raw)) {
    return raw as GuideYearsExperience;
  }
  return '1-3';
}

function normalizeGuideStatus(value: unknown): GuideStatus {
  const raw = String(value || '').trim();
  if (isGuideStatus(raw)) return raw;
  return 'draft';
}

export function normalizeGuideProfile(
  guideId: string,
  data: Record<string, unknown>,
): Guide | null {
  const uid = guideId.trim();
  if (!uid) return null;

  return {
    uid,
    displayName: String(data.displayName || '').trim(),
    phone: String(data.phone || '').trim(),
    email: String(data.email || '').trim(),
    bio: String(data.bio || '').trim(),
    languages: normalizeStringArray(data.languages),
    specialties: normalizeSpecialties(data.specialties),
    yearsExperience: normalizeYearsExperience(data.yearsExperience),
    allowedExperienceIds: normalizeAllowedExperienceIds(data.allowedExperienceIds),
    status: normalizeGuideStatus(data.status),
    photoUrl: data.photoUrl ? String(data.photoUrl).trim() : undefined,
    validatedAt: (data.validatedAt as Guide['validatedAt']) ?? undefined,
    validatedBy: data.validatedBy ? String(data.validatedBy).trim() : undefined,
    internalNotes: data.internalNotes ? String(data.internalNotes).trim() : undefined,
    createdAt: (data.createdAt as Guide['createdAt']) ?? new Date(),
    updatedAt: (data.updatedAt as Guide['updatedAt']) ?? new Date(),
  };
}

export function validateGuideBio(bio: string): GuideFieldError[] {
  const normalized = bio.trim();
  const errors: GuideFieldError[] = [];

  if (normalized.length < BIO_MIN_LENGTH) {
    errors.push({
      field: 'bio',
      message: `La biographie doit contenir au moins ${BIO_MIN_LENGTH} caractères.`,
    });
  } else if (normalized.length > BIO_MAX_LENGTH) {
    errors.push({
      field: 'bio',
      message: `La biographie ne doit pas dépasser ${BIO_MAX_LENGTH} caractères.`,
    });
  }

  return errors;
}

export function validateGuideLanguages(languages: string[]): GuideFieldError[] {
  const normalized = languages.map((lang) => lang.trim()).filter(Boolean);
  if (normalized.length < 1) {
    return [{ field: 'languages', message: 'Ajoutez au moins une langue.' }];
  }
  return [];
}

export function validateGuideSpecialties(specialties: string[]): GuideFieldError[] {
  const errors: GuideFieldError[] = [];
  const normalized: GuideSpecialty[] = [];
  const seen = new Set<string>();

  for (const item of specialties) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (!isGuideSpecialty(trimmed)) {
      errors.push({ field: 'specialties', message: `Spécialité invalide : ${trimmed}.` });
      continue;
    }
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  if (normalized.length < 1) {
    errors.push({ field: 'specialties', message: 'Sélectionnez au moins une spécialité.' });
  } else if (normalized.length > 3) {
    errors.push({ field: 'specialties', message: 'Maximum 3 spécialités par guide.' });
  }

  return errors;
}

export function validateAllowedExperienceIds(ids: string[]): GuideFieldError[] {
  const errors: GuideFieldError[] = [];
  const normalized: GuideExperienceId[] = [];
  const seen = new Set<string>();

  for (const item of ids) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (!isGuideExperienceId(trimmed)) {
      errors.push({ field: 'allowedExperienceIds', message: `Expérience invalide : ${trimmed}.` });
      continue;
    }
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  if (normalized.length < 1) {
    errors.push({
      field: 'allowedExperienceIds',
      message: 'Sélectionnez au moins une expérience autorisée.',
    });
  }

  return errors;
}

export function validateGuideInput(
  input: GuideFormInput,
  mode: 'create' | 'update',
): GuideValidationResult {
  const errors: GuideFieldError[] = [];

  if (!input.guideUid.trim()) {
    errors.push({ field: 'guideUid', message: 'Identifiant guide (uid Auth) requis.' });
  }

  if (!input.displayName.trim()) {
    errors.push({ field: 'displayName', message: 'Nom affiché requis.' });
  }

  if (!input.phone.trim()) {
    errors.push({ field: 'phone', message: 'Téléphone requis.' });
  }

  if (!input.email.trim()) {
    errors.push({ field: 'email', message: 'Email requis.' });
  }

  errors.push(...validateGuideBio(input.bio));
  errors.push(...validateGuideLanguages(input.languages));
  errors.push(...validateGuideSpecialties(input.specialties));
  errors.push(...validateAllowedExperienceIds(input.allowedExperienceIds));

  if (!GUIDE_YEARS_EXPERIENCE_OPTIONS.some((item) => item.id === input.yearsExperience)) {
    errors.push({ field: 'yearsExperience', message: 'Expérience professionnelle invalide.' });
  }

  if (input.photoUrl?.trim() === '') {
    errors.push({ field: 'photoUrl', message: 'URL photo invalide.' });
  }

  if (mode === 'create' && input.status && !ALLOWED_CREATE_STATUSES.includes(input.status)) {
    errors.push({
      field: 'status',
      message: 'Statut initial autorisé : brouillon ou en attente de validation.',
    });
  }

  return { ok: errors.length === 0, errors };
}

export type BuildGuideFirestorePayloadOptions = {
  status: GuideStatus;
  validatedAt?: unknown;
  validatedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export function buildGuideFirestorePayload(
  input: GuideFormInput,
  options: BuildGuideFirestorePayloadOptions,
): Record<string, unknown> {
  const languages = input.languages.map((lang) => lang.trim()).filter(Boolean);
  const specialties = input.specialties.filter((item, index, arr) => arr.indexOf(item) === index);
  const allowedExperienceIds = input.allowedExperienceIds.filter(
    (item, index, arr) => arr.indexOf(item) === index,
  );

  const payload: Record<string, unknown> = {
    uid: input.guideUid.trim(),
    displayName: input.displayName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    bio: input.bio.trim(),
    languages,
    specialties,
    yearsExperience: input.yearsExperience,
    allowedExperienceIds,
    status: options.status,
    updatedAt: options.updatedAt,
    createdAt: options.createdAt,
  };

  if (input.photoUrl?.trim()) {
    payload.photoUrl = input.photoUrl.trim();
  }

  if (input.internalNotes?.trim()) {
    payload.internalNotes = input.internalNotes.trim();
  }

  if (options.status === 'active') {
    if (options.validatedAt !== undefined) payload.validatedAt = options.validatedAt;
    if (options.validatedBy) payload.validatedBy = options.validatedBy;
  } else {
    if (options.validatedAt !== undefined) payload.validatedAt = options.validatedAt;
    if (options.validatedBy) payload.validatedBy = options.validatedBy;
  }

  return payload;
}

export function guideFormInputFromGuide(guide: Guide): GuideFormInput {
  return {
    guideUid: guide.uid,
    displayName: guide.displayName,
    phone: guide.phone,
    email: guide.email,
    bio: guide.bio,
    languages: [...guide.languages],
    specialties: [...guide.specialties],
    yearsExperience: guide.yearsExperience,
    allowedExperienceIds: [...guide.allowedExperienceIds],
    photoUrl: guide.photoUrl,
    internalNotes: guide.internalNotes,
    status: guide.status,
  };
}

export function mapGuideToAdminListItem(guide: Guide): AdminGuideListItem {
  return {
    uid: guide.uid,
    displayName: guide.displayName,
    phone: guide.phone,
    email: guide.email,
    status: guide.status,
    statusLabel: getGuideStatusLabel(guide.status),
    specialtiesSummary: formatGuideSpecialtiesSummary(guide.specialties),
    allowedExperienceCount: guide.allowedExperienceIds.length,
    yearsExperience: guide.yearsExperience,
    createdAt: guide.createdAt,
    updatedAt: guide.updatedAt,
    validatedAt: guide.validatedAt,
  };
}

export function mapGuideToAdminDetail(guide: Guide): AdminGuideDetail {
  return {
    ...mapGuideToAdminListItem(guide),
    bio: guide.bio,
    languages: [...guide.languages],
    specialties: [...guide.specialties],
    allowedExperienceIds: [...guide.allowedExperienceIds],
    photoUrl: guide.photoUrl,
    internalNotes: guide.internalNotes,
    validatedBy: guide.validatedBy,
  };
}

export function mapGuideToAssignableOption(guide: Guide): AssignableGuideOption {
  return {
    uid: guide.uid,
    displayName: guide.displayName,
    phone: guide.phone,
    specialtiesSummary: formatGuideSpecialtiesSummary(guide.specialties),
  };
}

export function validateBookingForGuideAssign(raw: Record<string, unknown>): {
  experienceId: GuideExperienceId;
} {
  if (!isGuideRequestedOnBooking(raw)) {
    throw new GuideServiceError(
      'BOOKING_GUIDE_NOT_REQUESTED',
      'Le client n\'a pas demandé d\'option guide sur cette réservation.',
    );
  }

  const source = String(raw.source || '').trim();
  if (source !== EXPERIENCES_PRIVATE_SOURCE) {
    throw new GuideServiceError(
      'BOOKING_NOT_EXPERIENCES_PRIVATE',
      'L\'assignation guide est réservée aux expériences privées.',
    );
  }

  const experienceId = resolveExperienceIdFromBooking(
    String(raw.circuitName || ''),
    String(raw.experience || ''),
  );

  if (!experienceId) {
    throw new GuideServiceError(
      'EXPERIENCE_NOT_RESOLVED',
      'Impossible d\'identifier l\'expérience catalogue de cette réservation.',
    );
  }

  return { experienceId };
}

export function wrapFirestoreError(error: unknown, fallbackCode: GuideServiceError['code']): never {
  if (error instanceof GuideServiceError) {
    throw error;
  }

  const code =
    error && typeof error === 'object' && 'code' in error && error.code === 'permission-denied'
      ? 'FIRESTORE_PERMISSION_DENIED'
      : fallbackCode;

  const message =
    code === 'FIRESTORE_PERMISSION_DENIED'
      ? 'Droits Firestore insuffisants pour cette opération guide.'
      : error instanceof Error
        ? error.message
        : 'Opération guide impossible.';

  throw new GuideServiceError(code, message, { cause: error });
}
