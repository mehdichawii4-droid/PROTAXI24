import {
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Partner, PartnerStatus } from '@/firebase/types';
import { getPartnerDocRef, getPartnersCollectionRef } from '@/firebase/firestore';
import {
  assertPartnerStatusTransition,
  getPartnerStatusLabel,
  normalizePartnerProfile,
  partnerFormInputFromPartner,
  resolveIsActiveForStatus,
  validatePartnerInput,
  wrapPartnerFirestoreError,
} from '@/services/partnerCoreService';
import type { AdminHotelDetail, AdminHotelListItem } from '@/types/partner';
import { PartnerServiceError } from '@/types/partner';
import { devError, devLog } from '@/utils/devLog';

const DESCRIPTION_PREVIEW_MAX = 100;

function requirePartnerUid(partnerUid: string): string {
  const normalized = partnerUid.trim();
  if (!normalized) {
    throw new PartnerServiceError('PARTNER_ID_REQUIRED', 'Identifiant hôtel requis.');
  }
  return normalized;
}

function requireAdminUid(adminUid: string): string {
  const normalized = adminUid.trim();
  if (!normalized) {
    throw new PartnerServiceError('FIRESTORE_WRITE_FAILED', 'Identifiant administrateur requis.');
  }
  return normalized;
}

function isHotelPartner(partner: Partner): boolean {
  return partner.partnerType === 'hotel';
}

function formatDescriptionPreview(description: string): string {
  const normalized = description.trim();
  if (!normalized) return '—';
  if (normalized.length <= DESCRIPTION_PREVIEW_MAX) return normalized;
  return `${normalized.slice(0, DESCRIPTION_PREVIEW_MAX).trim()}…`;
}

export function getHotelStatusLabel(status: PartnerStatus): string {
  return getPartnerStatusLabel(status);
}

function mapPartnerToAdminHotelListItem(partner: Partner): AdminHotelListItem {
  return {
    uid: partner.uid,
    companyName: partner.companyName,
    contactName: partner.contactName,
    phone: partner.phone,
    email: partner.email,
    city: partner.city,
    status: partner.status,
    statusLabel: getHotelStatusLabel(partner.status),
    isActive: partner.isActive,
    descriptionPreview: formatDescriptionPreview(partner.description),
    validatedAt: partner.validatedAt,
    updatedAt: partner.updatedAt,
    createdAt: partner.createdAt,
  };
}

function mapPartnerToAdminHotelDetail(partner: Partner): AdminHotelDetail {
  return {
    uid: partner.uid,
    companyName: partner.companyName,
    contactName: partner.contactName,
    phone: partner.phone,
    email: partner.email,
    address: partner.address,
    city: partner.city,
    postalCode: partner.postalCode,
    receptionPhone: partner.receptionPhone,
    website: partner.website,
    description: partner.description,
    status: partner.status,
    statusLabel: getHotelStatusLabel(partner.status),
    isActive: partner.isActive,
    validatedAt: partner.validatedAt,
    validatedBy: partner.validatedBy,
    updatedAt: partner.updatedAt,
    createdAt: partner.createdAt,
    internalNotes: partner.internalNotes,
  };
}

function sortHotelsByName(rows: AdminHotelListItem[]): AdminHotelListItem[] {
  return [...rows].sort((a, b) => a.companyName.localeCompare(b.companyName, 'fr'));
}

function mapSnapshotToHotelListItems(
  docs: { id: string; data: () => Record<string, unknown> }[],
): AdminHotelListItem[] {
  const rows: AdminHotelListItem[] = [];

  for (const docSnap of docs) {
    const partner = normalizePartnerProfile(docSnap.id, docSnap.data());
    if (!partner || !isHotelPartner(partner)) continue;
    rows.push(mapPartnerToAdminHotelListItem(partner));
  }

  return sortHotelsByName(rows);
}

async function loadHotelOrThrow(partnerUid: string): Promise<Partner> {
  const normalizedUid = requirePartnerUid(partnerUid);
  const snapshot = await getDoc(getPartnerDocRef(normalizedUid));

  if (!snapshot.exists()) {
    throw new PartnerServiceError('PARTNER_NOT_FOUND', 'Hôtel partenaire introuvable.');
  }

  const partner = normalizePartnerProfile(
    normalizedUid,
    snapshot.data() as Record<string, unknown>,
  );

  if (!partner || !isHotelPartner(partner)) {
    throw new PartnerServiceError('PARTNER_NOT_FOUND', 'Hôtel partenaire introuvable.');
  }

  return partner;
}

function assertHotelProfileReadyForActivation(partner: Partner): void {
  const input = partnerFormInputFromPartner(partner);
  const result = validatePartnerInput(input, 'update', { hotelSelf: true });
  if (!result.ok) {
    throw new PartnerServiceError(
      'PARTNER_VALIDATION_FAILED',
      'Le profil hôtel est incomplet ou invalide.',
      { fieldErrors: result.errors },
    );
  }
}

async function applyHotelStatusUpdate(
  partnerUid: string,
  nextStatus: PartnerStatus,
  adminUid?: string,
): Promise<AdminHotelDetail> {
  const normalizedUid = requirePartnerUid(partnerUid);
  const existing = await loadHotelOrThrow(normalizedUid);

  assertPartnerStatusTransition(existing.status, nextStatus);

  if (nextStatus === 'active') {
    assertHotelProfileReadyForActivation(existing);
  }

  const isActive = resolveIsActiveForStatus(nextStatus);
  const now = serverTimestamp();
  const activating = nextStatus === 'active';

  const patch: Record<string, unknown> = {
    status: nextStatus,
    isActive,
    updatedAt: now,
  };

  if (activating) {
    patch.validatedAt = now;
    if (adminUid) {
      patch.validatedBy = requireAdminUid(adminUid);
    }
  }

  try {
    await updateDoc(getPartnerDocRef(normalizedUid), patch);
    devLog('[ADMIN HOTELS] status updated', {
      partnerUid: normalizedUid,
      from: existing.status,
      to: nextStatus,
      adminUid: adminUid ?? null,
    });
    return mapPartnerToAdminHotelDetail(await loadHotelOrThrow(normalizedUid));
  } catch (error) {
    wrapPartnerFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export function subscribeHotels(
  onChange: (hotels: AdminHotelListItem[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    getPartnersCollectionRef(),
    (snapshot) => {
      const rows = mapSnapshotToHotelListItems(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          data: () => docSnap.data() as Record<string, unknown>,
        })),
      );
      devLog('[ADMIN HOTELS] snapshot', { count: rows.length });
      onChange(rows);
    },
    (error) => {
      devError('[ADMIN HOTELS] snapshot denied', error);
      onError?.(error);
    },
  );
}

export async function fetchHotelsByStatus(status: PartnerStatus): Promise<AdminHotelListItem[]> {
  try {
    const docsSnapshot = await getDocs(getPartnersCollectionRef());
    const rows = mapSnapshotToHotelListItems(
      docsSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        data: () => docSnap.data() as Record<string, unknown>,
      })),
    );
    return rows.filter((row) => row.status === status);
  } catch (error) {
    wrapPartnerFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

export async function fetchHotelDetails(partnerUid: string): Promise<AdminHotelDetail | null> {
  try {
    const partner = await loadHotelOrThrow(partnerUid);
    return mapPartnerToAdminHotelDetail(partner);
  } catch (error) {
    if (error instanceof PartnerServiceError && error.code === 'PARTNER_NOT_FOUND') {
      return null;
    }
    wrapPartnerFirestoreError(error, 'FIRESTORE_WRITE_FAILED');
  }
}

// ---------------------------------------------------------------------------
// Actions statut
// ---------------------------------------------------------------------------

export async function validateHotel(
  partnerUid: string,
  adminUid: string,
): Promise<AdminHotelDetail> {
  const normalizedAdminUid = requireAdminUid(adminUid);
  return applyHotelStatusUpdate(partnerUid, 'active', normalizedAdminUid);
}

export async function suspendHotel(partnerUid: string): Promise<AdminHotelDetail> {
  return applyHotelStatusUpdate(partnerUid, 'suspended');
}

export async function reactivateHotel(
  partnerUid: string,
  adminUid: string,
): Promise<AdminHotelDetail> {
  const normalizedAdminUid = requireAdminUid(adminUid);
  return applyHotelStatusUpdate(partnerUid, 'active', normalizedAdminUid);
}

// ---------------------------------------------------------------------------
// Erreurs
// ---------------------------------------------------------------------------

const HOTEL_ADMIN_ERROR_MESSAGES: Record<PartnerServiceError['code'], string> = {
  PARTNER_ID_REQUIRED: 'Identifiant hôtel requis.',
  PARTNER_UID_MISMATCH: 'Identifiant hôtel incohérent.',
  PARTNER_NOT_FOUND: 'Hôtel partenaire introuvable.',
  PARTNER_ALREADY_EXISTS: 'Un profil existe déjà pour cet identifiant.',
  PARTNER_VALIDATION_FAILED: 'Profil hôtel invalide. Vérifiez les champs obligatoires.',
  PARTNER_STATUS_TRANSITION_INVALID: 'Cette action de statut n\'est pas autorisée.',
  PARTNER_PROFILE_NOT_EDITABLE: 'Profil non modifiable dans cet état.',
  PARTNER_NOT_ACTIVE: 'Hôtel non actif.',
  PARTNER_HOTEL_SELF_ONLY: 'Action réservée aux comptes hôtel.',
  FIRESTORE_PERMISSION_DENIED: 'Droits insuffisants (admin requis).',
  FIRESTORE_WRITE_FAILED: 'Enregistrement impossible. Réessayez.',
};

export function getHotelAdminErrorMessage(error: unknown): string {
  if (error instanceof PartnerServiceError) {
    if (error.code === 'PARTNER_VALIDATION_FAILED' && error.fieldErrors?.length) {
      return error.fieldErrors.map((item) => item.message).join('\n');
    }
    return HOTEL_ADMIN_ERROR_MESSAGES[error.code] ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return HOTEL_ADMIN_ERROR_MESSAGES.FIRESTORE_WRITE_FAILED;
}
