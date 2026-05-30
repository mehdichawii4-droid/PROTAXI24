import { getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { getGuideDocRef } from '@/firebase/firestore';
import type { Guide, GuideStatus } from '@/firebase/types';
import {
  assertGuideStatusTransition,
  buildGuideFirestorePayload,
  formatGuideSpecialtiesSummary,
  getGuideStatusLabel,
  guideFormInputFromGuide,
  normalizeGuideProfile,
  validateGuideInput,
  wrapFirestoreError,
} from '@/services/guideService';
import type { GuideFormInput, GuideSelfProfile } from '@/types/guide';
import { GuideServiceError as GuideError } from '@/types/guide';
import { devLog } from '@/utils/devLog';

const SELF_EDITABLE_STATUSES: GuideStatus[] = ['draft', 'pending_review'];
const SELF_INITIAL_STATUS: GuideStatus = 'pending_review';

function requireGuideUid(guideUid: string): string {
  const normalized = guideUid.trim();
  if (!normalized) {
    throw new GuideError('GUIDE_ID_REQUIRED', 'Identifiant guide requis.');
  }
  return normalized;
}

function assertUidMatchesInput(guideUid: string, input: GuideFormInput): void {
  const inputUid = input.guideUid.trim();
  if (inputUid && inputUid !== guideUid) {
    throw new GuideError(
      'GUIDE_UID_MISMATCH',
      'L\'identifiant du formulaire ne correspond pas au compte connecté.',
    );
  }
}

function assertValidation(input: GuideFormInput, mode: 'create' | 'update'): void {
  const result = validateGuideInput(input, mode);
  if (!result.ok) {
    throw new GuideError('GUIDE_VALIDATION_FAILED', 'Le profil guide est incomplet ou invalide.', {
      fieldErrors: result.errors,
    });
  }
}

function assertSelfEditableStatus(status: GuideStatus): void {
  if (!SELF_EDITABLE_STATUSES.includes(status)) {
    throw new GuideError(
      'GUIDE_PROFILE_NOT_EDITABLE',
      'Ce profil ne peut plus être modifié depuis l\'espace guide.',
    );
  }
}

function sanitizeSelfFormInput(guideUid: string, input: GuideFormInput): GuideFormInput {
  return {
    guideUid,
    displayName: input.displayName,
    phone: input.phone,
    email: input.email,
    bio: input.bio,
    languages: [...input.languages],
    specialties: [...input.specialties],
    yearsExperience: input.yearsExperience,
    allowedExperienceIds: [...input.allowedExperienceIds],
    photoUrl: input.photoUrl?.trim() || undefined,
  };
}

function mapGuideToSelfProfile(guide: Guide): GuideSelfProfile {
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
    bio: guide.bio,
    languages: [...guide.languages],
    specialties: [...guide.specialties],
    allowedExperienceIds: [...guide.allowedExperienceIds],
    photoUrl: guide.photoUrl,
    createdAt: guide.createdAt,
    updatedAt: guide.updatedAt,
    validatedAt: guide.validatedAt,
  };
}

async function loadGuideOrThrow(guideUid: string): Promise<Guide> {
  const normalizedUid = requireGuideUid(guideUid);
  const snapshot = await getDoc(getGuideDocRef(normalizedUid));

  if (!snapshot.exists()) {
    throw new GuideError('GUIDE_NOT_FOUND', 'Profil guide introuvable.');
  }

  const guide = normalizeGuideProfile(normalizedUid, snapshot.data() as Record<string, unknown>);
  if (!guide) {
    throw new GuideError('GUIDE_NOT_FOUND', 'Profil guide introuvable.');
  }

  return guide;
}

type WriteSelfGuideOptions = {
  preserveCreatedAt?: unknown;
  merge?: boolean;
};

async function writeSelfGuideDocument(
  guideUid: string,
  input: GuideFormInput,
  status: GuideStatus,
  options?: WriteSelfGuideOptions,
): Promise<void> {
  const now = serverTimestamp();
  const payload = buildGuideFirestorePayload(input, {
    status,
    createdAt: options?.preserveCreatedAt ?? now,
    updatedAt: now,
  });

  delete payload.internalNotes;
  delete payload.validatedAt;
  delete payload.validatedBy;

  await setDoc(getGuideDocRef(guideUid), payload, { merge: options?.merge ?? true });
}

const SELF_ERROR_MESSAGES: Partial<Record<GuideError['code'], string>> = {
  GUIDE_ID_REQUIRED: 'Identifiant guide requis.',
  GUIDE_UID_MISMATCH: 'Identifiant guide incohérent avec la session.',
  GUIDE_NOT_FOUND: 'Profil guide introuvable.',
  GUIDE_ALREADY_EXISTS: 'Un profil guide existe déjà pour ce compte.',
  GUIDE_VALIDATION_FAILED: 'Profil guide invalide. Vérifiez les champs.',
  GUIDE_STATUS_TRANSITION_INVALID: 'Cette action de statut n\'est pas autorisée.',
  GUIDE_PROFILE_NOT_EDITABLE: 'Profil non modifiable dans cet état.',
  FIRESTORE_PERMISSION_DENIED: 'Droits insuffisants pour enregistrer le profil guide.',
  FIRESTORE_WRITE_FAILED: 'Enregistrement impossible. Réessayez.',
};

export function getGuideSelfErrorMessage(error: unknown): string {
  if (error instanceof GuideError) {
    if (error.code === 'GUIDE_VALIDATION_FAILED' && error.fieldErrors?.length) {
      return error.fieldErrors.map((item) => item.message).join('\n');
    }
    return SELF_ERROR_MESSAGES[error.code] ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return SELF_ERROR_MESSAGES.FIRESTORE_WRITE_FAILED ?? 'Opération impossible.';
}

/**
 * Crée guides/{uid} pour l'inscription autonome (statut pending_review).
 * Le caller doit passer uid === auth.uid.
 */
export async function registerGuideProfile(
  uid: string,
  input: GuideFormInput,
): Promise<GuideSelfProfile> {
  const guideUid = requireGuideUid(uid);
  assertUidMatchesInput(guideUid, input);

  const formInput = sanitizeSelfFormInput(guideUid, input);

  try {
    const existing = await getDoc(getGuideDocRef(guideUid));
    if (existing.exists()) {
      throw new GuideError(
        'GUIDE_ALREADY_EXISTS',
        'Un profil guide existe déjà pour ce compte.',
      );
    }

    assertValidation({ ...formInput, status: SELF_INITIAL_STATUS }, 'create');
    await writeSelfGuideDocument(guideUid, formInput, SELF_INITIAL_STATUS, { merge: false });

    devLog('[GUIDE SELF] profile registered', { guideUid, status: SELF_INITIAL_STATUS });
    return mapGuideToSelfProfile(await loadGuideOrThrow(guideUid));
  } catch (error) {
    wrapFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

/** Lecture du profil guide par le propriétaire (guides/{uid}). */
export async function fetchMyGuideProfile(uid: string): Promise<GuideSelfProfile | null> {
  const guideUid = requireGuideUid(uid);

  try {
    const guide = await loadGuideOrThrow(guideUid);
    return mapGuideToSelfProfile(guide);
  } catch (error) {
    if (error instanceof GuideError && error.code === 'GUIDE_NOT_FOUND') {
      return null;
    }
    wrapFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

/**
 * Met à jour le profil tant que status ∈ draft | pending_review.
 * Ne modifie jamais internalNotes / validatedAt / validatedBy.
 */
export async function updateMyGuideProfile(
  uid: string,
  input: GuideFormInput,
): Promise<GuideSelfProfile> {
  const guideUid = requireGuideUid(uid);
  assertUidMatchesInput(guideUid, input);

  try {
    const existing = await loadGuideOrThrow(guideUid);
    assertSelfEditableStatus(existing.status);

    const merged = guideFormInputFromGuide({
      ...existing,
      ...sanitizeSelfFormInput(guideUid, input),
      guideUid,
      status: existing.status,
    });

    assertValidation(merged, 'update');
    await writeSelfGuideDocument(guideUid, merged, existing.status, {
      preserveCreatedAt: existing.createdAt,
      merge: true,
    });

    devLog('[GUIDE SELF] profile updated', { guideUid, status: existing.status });
    return mapGuideToSelfProfile(await loadGuideOrThrow(guideUid));
  } catch (error) {
    wrapFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

/** Passe le dossier en pending_review (depuis draft, ou no-op si déjà en attente). */
export async function submitMyGuideForReview(uid: string): Promise<GuideSelfProfile> {
  const guideUid = requireGuideUid(uid);

  try {
    const existing = await loadGuideOrThrow(guideUid);

    if (existing.status === 'pending_review') {
      return mapGuideToSelfProfile(existing);
    }

    assertSelfEditableStatus(existing.status);
    assertGuideStatusTransition(existing.status, 'pending_review');

    const formInput = guideFormInputFromGuide(existing);
    assertValidation(formInput, 'update');
    await writeSelfGuideDocument(guideUid, formInput, 'pending_review', {
      preserveCreatedAt: existing.createdAt,
      merge: true,
    });

    devLog('[GUIDE SELF] submitted for review', { guideUid });
    return mapGuideToSelfProfile(await loadGuideOrThrow(guideUid));
  } catch (error) {
    wrapFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}
