import { getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { getPartnerDocRef } from '@/firebase/firestore';
import type { Partner, PartnerStatus } from '@/firebase/types';
import {
  assertPartnerStatusTransition,
  buildPartnerFirestorePayload,
  isPartnerEditable,
  mapPartnerToSelfProfile,
  normalizePartnerProfile,
  partnerFormInputFromPartner,
  validatePartnerInput,
  wrapPartnerFirestoreError,
} from '@/services/partnerCoreService';
import type { PartnerFormInput, PartnerSelfProfile } from '@/types/partner';
import { PartnerServiceError as PartnerError } from '@/types/partner';
import { devLog } from '@/utils/devLog';

const SELF_INITIAL_STATUS: PartnerStatus = 'pending_review';
const HOTEL_PARTNER_TYPE = 'hotel' as const;

function requirePartnerUid(partnerUid: string): string {
  const normalized = partnerUid.trim();
  if (!normalized) {
    throw new PartnerError('PARTNER_ID_REQUIRED', 'Identifiant partenaire requis.');
  }
  return normalized;
}

function assertUidMatchesInput(partnerUid: string, input: PartnerFormInput): void {
  const inputUid = input.partnerUid.trim();
  if (inputUid && inputUid !== partnerUid) {
    throw new PartnerError(
      'PARTNER_UID_MISMATCH',
      'L\'identifiant du formulaire ne correspond pas au compte connecté.',
    );
  }
}

function assertHotelSelfInput(input: PartnerFormInput): void {
  if (input.partnerType !== HOTEL_PARTNER_TYPE) {
    throw new PartnerError(
      'PARTNER_HOTEL_SELF_ONLY',
      'L\'auto-gestion est réservée aux établissements hôteliers.',
    );
  }
}

function assertHotelSelfPartner(partner: Partner): void {
  if (partner.partnerType !== HOTEL_PARTNER_TYPE) {
    throw new PartnerError(
      'PARTNER_HOTEL_SELF_ONLY',
      'Ce compte partenaire n\'est pas un profil hôtel auto-géré.',
    );
  }
}

function assertValidation(input: PartnerFormInput, mode: 'create' | 'update'): void {
  const result = validatePartnerInput(input, mode, { hotelSelf: true });
  if (!result.ok) {
    throw new PartnerError('PARTNER_VALIDATION_FAILED', 'Le profil hôtel est incomplet ou invalide.', {
      fieldErrors: result.errors,
    });
  }
}

function assertSelfEditableStatus(status: PartnerStatus): void {
  if (!isPartnerEditable(status)) {
    throw new PartnerError(
      'PARTNER_PROFILE_NOT_EDITABLE',
      'Ce profil ne peut plus être modifié depuis l\'espace partenaire.',
    );
  }
}

function sanitizeSelfFormInput(partnerUid: string, input: PartnerFormInput): PartnerFormInput {
  return {
    partnerUid,
    companyName: input.companyName,
    partnerType: HOTEL_PARTNER_TYPE,
    contactName: input.contactName,
    phone: input.phone,
    email: input.email,
    address: input.address?.trim() || undefined,
    city: input.city?.trim() || undefined,
    postalCode: input.postalCode?.trim() || undefined,
    receptionPhone: input.receptionPhone?.trim() || undefined,
    website: input.website?.trim() || undefined,
  };
}

async function loadPartnerOrThrow(partnerUid: string): Promise<Partner> {
  const normalizedUid = requirePartnerUid(partnerUid);
  const snapshot = await getDoc(getPartnerDocRef(normalizedUid));

  if (!snapshot.exists()) {
    throw new PartnerError('PARTNER_NOT_FOUND', 'Profil partenaire introuvable.');
  }

  const partner = normalizePartnerProfile(
    normalizedUid,
    snapshot.data() as Record<string, unknown>,
  );
  if (!partner) {
    throw new PartnerError('PARTNER_NOT_FOUND', 'Profil partenaire introuvable.');
  }

  return partner;
}

type WriteSelfPartnerOptions = {
  preserveCreatedAt?: unknown;
  merge?: boolean;
};

async function writeSelfPartnerDocument(
  partnerUid: string,
  input: PartnerFormInput,
  status: PartnerStatus,
  options?: WriteSelfPartnerOptions,
): Promise<void> {
  const now = serverTimestamp();
  const payload = buildPartnerFirestorePayload(input, {
    status,
    isActive: status === 'active',
    createdAt: options?.preserveCreatedAt ?? now,
    updatedAt: now,
  });

  delete payload.internalNotes;
  delete payload.validatedAt;
  delete payload.validatedBy;

  await setDoc(getPartnerDocRef(partnerUid), payload, { merge: options?.merge ?? true });
}

const SELF_ERROR_MESSAGES: Partial<Record<PartnerError['code'], string>> = {
  PARTNER_ID_REQUIRED: 'Identifiant partenaire requis.',
  PARTNER_UID_MISMATCH: 'Identifiant partenaire incohérent avec la session.',
  PARTNER_NOT_FOUND: 'Profil partenaire introuvable.',
  PARTNER_ALREADY_EXISTS: 'Un profil partenaire existe déjà pour ce compte.',
  PARTNER_VALIDATION_FAILED: 'Profil hôtel invalide. Vérifiez les champs.',
  PARTNER_STATUS_TRANSITION_INVALID: 'Cette action de statut n\'est pas autorisée.',
  PARTNER_PROFILE_NOT_EDITABLE: 'Profil non modifiable dans cet état.',
  PARTNER_HOTEL_SELF_ONLY: 'Action réservée aux comptes hôtel.',
  FIRESTORE_PERMISSION_DENIED: 'Droits insuffisants pour enregistrer le profil partenaire.',
  FIRESTORE_WRITE_FAILED: 'Enregistrement impossible. Réessayez.',
};

export function getPartnerSelfErrorMessage(error: unknown): string {
  if (error instanceof PartnerError) {
    if (error.code === 'PARTNER_VALIDATION_FAILED' && error.fieldErrors?.length) {
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
 * Crée partners/{uid} pour l'inscription hôtel autonome (statut pending_review, isActive false).
 * Le caller doit passer uid === auth.uid.
 */
export async function registerPartnerProfile(
  uid: string,
  input: PartnerFormInput,
): Promise<PartnerSelfProfile> {
  const partnerUid = requirePartnerUid(uid);
  assertUidMatchesInput(partnerUid, input);
  assertHotelSelfInput(input);

  const formInput = sanitizeSelfFormInput(partnerUid, input);

  try {
    const existing = await getDoc(getPartnerDocRef(partnerUid));
    if (existing.exists()) {
      throw new PartnerError(
        'PARTNER_ALREADY_EXISTS',
        'Un profil partenaire existe déjà pour ce compte.',
      );
    }

    assertValidation({ ...formInput, status: SELF_INITIAL_STATUS }, 'create');
    await writeSelfPartnerDocument(partnerUid, formInput, SELF_INITIAL_STATUS, { merge: false });

    devLog('[PARTNER SELF] hotel profile registered', {
      partnerUid,
      status: SELF_INITIAL_STATUS,
    });
    const partner = await loadPartnerOrThrow(partnerUid);
    assertHotelSelfPartner(partner);
    return mapPartnerToSelfProfile(partner);
  } catch (error) {
    wrapPartnerFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

/** Lecture du profil partenaire par le propriétaire (partners/{uid}). */
export async function fetchMyPartnerProfile(uid: string): Promise<PartnerSelfProfile | null> {
  const partnerUid = requirePartnerUid(uid);

  try {
    const partner = await loadPartnerOrThrow(partnerUid);
    return mapPartnerToSelfProfile(partner);
  } catch (error) {
    if (error instanceof PartnerError && error.code === 'PARTNER_NOT_FOUND') {
      return null;
    }
    wrapPartnerFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

/**
 * Met à jour le profil hôtel tant que status ∈ draft | pending_review.
 * Ne modifie jamais internalNotes / validatedAt / validatedBy.
 */
export async function updateMyPartnerProfile(
  uid: string,
  input: PartnerFormInput,
): Promise<PartnerSelfProfile> {
  const partnerUid = requirePartnerUid(uid);
  assertUidMatchesInput(partnerUid, input);
  assertHotelSelfInput(input);

  try {
    const existing = await loadPartnerOrThrow(partnerUid);
    assertHotelSelfPartner(existing);
    assertSelfEditableStatus(existing.status);

    const merged = partnerFormInputFromPartner({
      ...existing,
      ...sanitizeSelfFormInput(partnerUid, input),
      uid: partnerUid,
      partnerType: HOTEL_PARTNER_TYPE,
      status: existing.status,
      isActive: existing.isActive,
    });

    assertValidation(merged, 'update');
    await writeSelfPartnerDocument(partnerUid, merged, existing.status, {
      preserveCreatedAt: existing.createdAt,
      merge: true,
    });

    devLog('[PARTNER SELF] hotel profile updated', { partnerUid, status: existing.status });
    const partner = await loadPartnerOrThrow(partnerUid);
    return mapPartnerToSelfProfile(partner);
  } catch (error) {
    wrapPartnerFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

/** Passe le dossier en pending_review (depuis draft, ou no-op si déjà en attente). */
export async function submitMyPartnerForReview(uid: string): Promise<PartnerSelfProfile> {
  const partnerUid = requirePartnerUid(uid);

  try {
    const existing = await loadPartnerOrThrow(partnerUid);
    assertHotelSelfPartner(existing);

    if (existing.status === 'pending_review') {
      return mapPartnerToSelfProfile(existing);
    }

    assertSelfEditableStatus(existing.status);
    assertPartnerStatusTransition(existing.status, 'pending_review');

    const formInput = partnerFormInputFromPartner(existing);
    assertValidation(formInput, 'update');
    await writeSelfPartnerDocument(partnerUid, formInput, 'pending_review', {
      preserveCreatedAt: existing.createdAt,
      merge: true,
    });

    devLog('[PARTNER SELF] hotel profile submitted for review', { partnerUid });
    const partner = await loadPartnerOrThrow(partnerUid);
    return mapPartnerToSelfProfile(partner);
  } catch (error) {
    wrapPartnerFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}
