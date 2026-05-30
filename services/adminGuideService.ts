import {
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  getGuideDocRef,
  getGuidesCollectionRef,
  getTourBookingDocRef,
} from '@/firebase/firestore';
import type { GuideStatus } from '@/firebase/types';
import {
  assertGuideStatusTransition,
  buildGuideFirestorePayload,
  canGuideServeExperience,
  guideFormInputFromGuide,
  mapGuideToAdminDetail,
  mapGuideToAdminListItem,
  mapGuideToAssignableOption,
  normalizeGuideProfile,
  validateBookingForGuideAssign,
  validateGuideInput,
  wrapFirestoreError,
} from '@/services/guideService';
import type {
  AdminGuideDetail,
  AdminGuideListItem,
  AssignableGuideOption,
  AssignGuideResult,
  GuideFormInput,
} from '@/types/guide';
import { GuideServiceError as GuideError } from '@/types/guide';
import { devError, devLog } from '@/utils/devLog';

function sortGuidesByName(rows: AdminGuideListItem[]): AdminGuideListItem[] {
  return [...rows].sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr'));
}

function mapSnapshotToGuideListItems(
  docs: { id: string; data: () => Record<string, unknown> }[],
): AdminGuideListItem[] {
  const rows: AdminGuideListItem[] = [];

  for (const docSnap of docs) {
    const guide = normalizeGuideProfile(docSnap.id, docSnap.data());
    if (!guide) continue;
    rows.push(mapGuideToAdminListItem(guide));
  }

  return sortGuidesByName(rows);
}

function requireGuideUid(guideUid: string): string {
  const normalized = guideUid.trim();
  if (!normalized) {
    throw new GuideError('GUIDE_ID_REQUIRED', 'Identifiant guide requis.');
  }
  return normalized;
}

function requireAdminUid(adminUid: string): string {
  const normalized = adminUid.trim();
  if (!normalized) {
    throw new GuideError('FIRESTORE_WRITE_FAILED', 'Identifiant administrateur requis.');
  }
  return normalized;
}

function assertValidation(input: GuideFormInput, mode: 'create' | 'update'): void {
  const result = validateGuideInput(input, mode);
  if (!result.ok) {
    throw new GuideError('GUIDE_VALIDATION_FAILED', 'Le profil guide est incomplet ou invalide.', {
      fieldErrors: result.errors,
    });
  }
}

async function loadGuideOrThrow(guideUid: string) {
  const normalizedUid = requireGuideUid(guideUid);
  const snapshot = await getDoc(getGuideDocRef(normalizedUid));

  if (!snapshot.exists()) {
    throw new GuideError('GUIDE_NOT_FOUND', 'Guide introuvable.');
  }

  const guide = normalizeGuideProfile(normalizedUid, snapshot.data() as Record<string, unknown>);
  if (!guide) {
    throw new GuideError('GUIDE_NOT_FOUND', 'Guide introuvable.');
  }

  return guide;
}

type WriteGuideDocumentOptions = {
  validatedBy?: string;
  validatedAt?: unknown;
  preserveCreatedAt?: unknown;
  /** Si true, n'écrase pas validatedAt/By (mise à jour profil d'un guide actif). */
  preserveValidation?: boolean;
  merge?: boolean;
};

async function writeGuideDocument(
  guideUid: string,
  input: GuideFormInput,
  status: GuideStatus,
  options?: WriteGuideDocumentOptions,
): Promise<void> {
  const now = serverTimestamp();
  const activating = status === 'active' && !options?.preserveValidation;

  const payload = buildGuideFirestorePayload(input, {
    status,
    createdAt: options?.preserveCreatedAt ?? now,
    updatedAt: now,
    validatedAt: activating ? now : options?.validatedAt,
    validatedBy: activating ? options?.validatedBy : options?.validatedBy,
  });

  await setDoc(getGuideDocRef(guideUid), payload, { merge: options?.merge ?? true });
}

// ---------------------------------------------------------------------------
// Phase B — lecture
// ---------------------------------------------------------------------------

export function subscribeGuides(
  onChange: (guides: AdminGuideListItem[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    getGuidesCollectionRef(),
    (snapshot) => {
      const rows = mapSnapshotToGuideListItems(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          data: () => docSnap.data() as Record<string, unknown>,
        })),
      );
      devLog('[ADMIN GUIDES] snapshot', { count: rows.length });
      onChange(rows);
    },
    (error) => {
      devError('[ADMIN GUIDES] snapshot denied', error);
      onError?.(error);
    },
  );
}

export function subscribeGuidesByStatus(
  status: GuideStatus,
  onChange: (guides: AdminGuideListItem[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  return subscribeGuides((guides) => {
    onChange(guides.filter((row) => row.status === status));
  }, onError);
}

export async function fetchGuideDetail(guideUid: string): Promise<AdminGuideDetail | null> {
  try {
    const guide = await loadGuideOrThrow(guideUid);
    return mapGuideToAdminDetail(guide);
  } catch (error) {
    if (error instanceof GuideError && error.code === 'GUIDE_NOT_FOUND') {
      return null;
    }
    wrapFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

// ---------------------------------------------------------------------------
// Phase C — écriture guides/{uid}
// ---------------------------------------------------------------------------

export async function createGuide(input: GuideFormInput): Promise<AdminGuideDetail> {
  const guideUid = requireGuideUid(input.guideUid);
  assertValidation(input, 'create');

  const initialStatus: GuideStatus =
    input.status === 'draft' ? 'draft' : 'pending_review';

  try {
    const existing = await getDoc(getGuideDocRef(guideUid));
    if (existing.exists()) {
      throw new GuideError(
        'GUIDE_ALREADY_EXISTS',
        'Un profil guide existe déjà pour cet identifiant Auth.',
      );
    }

    const formInput: GuideFormInput = { ...input, guideUid, status: initialStatus };
    await writeGuideDocument(guideUid, formInput, initialStatus, { merge: false });

    devLog('[ADMIN GUIDES] guide created', { guideUid, status: initialStatus });
    return mapGuideToAdminDetail(await loadGuideOrThrow(guideUid));
  } catch (error) {
    wrapFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

export async function updateGuideProfile(
  input: GuideFormInput,
): Promise<AdminGuideDetail> {
  const guideUid = requireGuideUid(input.guideUid);
  assertValidation(input, 'update');

  try {
    const existing = await loadGuideOrThrow(guideUid);
    const formInput = guideFormInputFromGuide({
      ...existing,
      ...input,
      guideUid,
      status: existing.status,
    });

    await writeGuideDocument(guideUid, formInput, existing.status, {
      preserveCreatedAt: existing.createdAt,
      preserveValidation: existing.status === 'active',
      validatedAt: existing.validatedAt,
      validatedBy: existing.validatedBy,
    });

    devLog('[ADMIN GUIDES] guide profile updated', { guideUid });
    return mapGuideToAdminDetail(await loadGuideOrThrow(guideUid));
  } catch (error) {
    wrapFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

export async function submitGuideForReview(guideUid: string): Promise<AdminGuideDetail> {
  const normalizedUid = requireGuideUid(guideUid);

  try {
    const existing = await loadGuideOrThrow(normalizedUid);
    assertGuideStatusTransition(existing.status, 'pending_review');

    const formInput = guideFormInputFromGuide(existing);
    assertValidation(formInput, 'update');
    await writeGuideDocument(normalizedUid, formInput, 'pending_review', {
      preserveCreatedAt: existing.createdAt,
    });

    devLog('[ADMIN GUIDES] submitted for review', { guideUid: normalizedUid });
    return mapGuideToAdminDetail(await loadGuideOrThrow(normalizedUid));
  } catch (error) {
    wrapFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

export async function validateGuide(
  guideUid: string,
  adminUid: string,
): Promise<AdminGuideDetail> {
  const normalizedUid = requireGuideUid(guideUid);
  const normalizedAdminUid = requireAdminUid(adminUid);

  try {
    const existing = await loadGuideOrThrow(normalizedUid);
    assertGuideStatusTransition(existing.status, 'active');

    const formInput = guideFormInputFromGuide(existing);
    assertValidation(formInput, 'update');
    await writeGuideDocument(normalizedUid, formInput, 'active', {
      preserveCreatedAt: existing.createdAt,
      validatedBy: normalizedAdminUid,
    });

    devLog('[ADMIN GUIDES] guide validated', {
      guideUid: normalizedUid,
      adminUid: normalizedAdminUid,
    });
    return mapGuideToAdminDetail(await loadGuideOrThrow(normalizedUid));
  } catch (error) {
    wrapFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

export async function suspendGuide(guideUid: string): Promise<AdminGuideDetail> {
  const normalizedUid = requireGuideUid(guideUid);

  try {
    const existing = await loadGuideOrThrow(normalizedUid);
    assertGuideStatusTransition(existing.status, 'suspended');

    const formInput = guideFormInputFromGuide(existing);
    assertValidation(formInput, 'update');

    const now = serverTimestamp();
    const payload = buildGuideFirestorePayload(formInput, {
      status: 'suspended',
      createdAt: existing.createdAt,
      updatedAt: now,
      validatedAt: existing.validatedAt,
      validatedBy: existing.validatedBy,
    });

    await setDoc(getGuideDocRef(normalizedUid), payload, { merge: true });

    devLog('[ADMIN GUIDES] guide suspended', { guideUid: normalizedUid });
    return mapGuideToAdminDetail(await loadGuideOrThrow(normalizedUid));
  } catch (error) {
    wrapFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

export async function reactivateGuide(
  guideUid: string,
  adminUid: string,
): Promise<AdminGuideDetail> {
  const normalizedUid = requireGuideUid(guideUid);
  const normalizedAdminUid = requireAdminUid(adminUid);

  try {
    const existing = await loadGuideOrThrow(normalizedUid);
    assertGuideStatusTransition(existing.status, 'active');

    const formInput = guideFormInputFromGuide(existing);
    assertValidation(formInput, 'update');
    await writeGuideDocument(normalizedUid, formInput, 'active', {
      preserveCreatedAt: existing.createdAt,
      validatedBy: normalizedAdminUid,
    });

    devLog('[ADMIN GUIDES] guide reactivated', {
      guideUid: normalizedUid,
      adminUid: normalizedAdminUid,
    });
    return mapGuideToAdminDetail(await loadGuideOrThrow(normalizedUid));
  } catch (error) {
    wrapFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

// ---------------------------------------------------------------------------
// Phase D — tourBookings
// ---------------------------------------------------------------------------

async function loadAllGuides(): Promise<NonNullable<ReturnType<typeof normalizeGuideProfile>>[]> {
  const snapshot = await getDocs(getGuidesCollectionRef());
  const guides: NonNullable<ReturnType<typeof normalizeGuideProfile>>[] = [];

  snapshot.docs.forEach((docSnap) => {
    const guide = normalizeGuideProfile(docSnap.id, docSnap.data() as Record<string, unknown>);
    if (guide) guides.push(guide);
  });

  return guides;
}

export async function listAssignableGuidesForBooking(
  bookingId: string,
): Promise<AssignableGuideOption[]> {
  const normalizedBookingId = bookingId.trim();
  if (!normalizedBookingId) {
    throw new GuideError('BOOKING_NOT_FOUND', 'Réservation introuvable.');
  }

  try {
    const bookingSnap = await getDoc(getTourBookingDocRef(normalizedBookingId));
    if (!bookingSnap.exists()) {
      throw new GuideError('BOOKING_NOT_FOUND', 'Réservation introuvable.');
    }

    const bookingData = bookingSnap.data() as Record<string, unknown>;
    const { experienceId } = validateBookingForGuideAssign(bookingData);

    const guides = await loadAllGuides();
    return guides
      .filter((guide) => canGuideServeExperience(guide, experienceId))
      .map((guide) => mapGuideToAssignableOption(guide))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr'));
  } catch (error) {
    wrapFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

export async function assignGuideToTourBooking(
  bookingId: string,
  guideUid: string,
  adminUid: string,
): Promise<AssignGuideResult> {
  const normalizedBookingId = bookingId.trim();
  const normalizedGuideUid = requireGuideUid(guideUid);
  const normalizedAdminUid = requireAdminUid(adminUid);

  try {
    const bookingSnap = await getDoc(getTourBookingDocRef(normalizedBookingId));
    if (!bookingSnap.exists()) {
      throw new GuideError('BOOKING_NOT_FOUND', 'Réservation introuvable.');
    }

    const bookingData = bookingSnap.data() as Record<string, unknown>;
    const { experienceId } = validateBookingForGuideAssign(bookingData);

    const guide = await loadGuideOrThrow(normalizedGuideUid);
    if (!canGuideServeExperience(guide, experienceId)) {
      throw new GuideError(
        'GUIDE_EXPERIENCE_NOT_ALLOWED',
        'Ce guide n\'est pas autorisé sur cette expérience.',
      );
    }

    await updateDoc(getTourBookingDocRef(normalizedBookingId), {
      assignedGuideId: guide.uid,
      assignedGuideName: guide.displayName,
      guideAssignedAt: serverTimestamp(),
      guideAssignedBy: normalizedAdminUid,
    });

    devLog('[ADMIN GUIDES] guide assigned to booking', {
      bookingId: normalizedBookingId,
      guideUid: guide.uid,
      adminUid: normalizedAdminUid,
    });

    return {
      bookingId: normalizedBookingId,
      assignedGuideId: guide.uid,
      assignedGuideName: guide.displayName,
    };
  } catch (error) {
    wrapFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

export async function clearGuideAssignment(bookingId: string): Promise<void> {
  const normalizedBookingId = bookingId.trim();
  if (!normalizedBookingId) {
    throw new GuideError('BOOKING_NOT_FOUND', 'Réservation introuvable.');
  }

  try {
    const bookingSnap = await getDoc(getTourBookingDocRef(normalizedBookingId));
    if (!bookingSnap.exists()) {
      throw new GuideError('BOOKING_NOT_FOUND', 'Réservation introuvable.');
    }

    await updateDoc(getTourBookingDocRef(normalizedBookingId), {
      assignedGuideId: null,
      assignedGuideName: null,
      guideAssignedAt: null,
      guideAssignedBy: null,
    });

    devLog('[ADMIN GUIDES] guide assignment cleared', { bookingId: normalizedBookingId });
  } catch (error) {
    wrapFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

const ASSIGN_ERROR_MESSAGES: Record<GuideError['code'], string> = {
  GUIDE_ID_REQUIRED: 'Identifiant guide requis.',
  GUIDE_NOT_FOUND: 'Guide introuvable.',
  GUIDE_ALREADY_EXISTS: 'Un profil existe déjà pour cet identifiant.',
  GUIDE_VALIDATION_FAILED: 'Profil guide invalide. Vérifiez les champs.',
  GUIDE_STATUS_TRANSITION_INVALID: 'Cette action de statut n\'est pas autorisée.',
  GUIDE_NOT_ASSIGNABLE: 'Ce guide n\'est pas actif.',
  EXPERIENCE_NOT_RESOLVED: 'Expérience de la réservation non reconnue.',
  BOOKING_NOT_FOUND: 'Réservation introuvable.',
  BOOKING_GUIDE_NOT_REQUESTED: 'Le client n\'a pas demandé de guide.',
  BOOKING_NOT_EXPERIENCES_PRIVATE: 'Réservation hors expériences privées.',
  GUIDE_EXPERIENCE_NOT_ALLOWED: 'Ce guide n\'intervient pas sur cette expérience.',
  FIRESTORE_PERMISSION_DENIED: 'Droits insuffisants (admin requis).',
  FIRESTORE_WRITE_FAILED: 'Enregistrement impossible. Réessayez.',
};

export function getGuideAssignErrorMessage(error: unknown): string {
  if (error instanceof GuideError) {
    if (error.code === 'GUIDE_VALIDATION_FAILED' && error.fieldErrors?.length) {
      return error.fieldErrors.map((item) => item.message).join('\n');
    }
    return ASSIGN_ERROR_MESSAGES[error.code] ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return ASSIGN_ERROR_MESSAGES.FIRESTORE_WRITE_FAILED;
}
