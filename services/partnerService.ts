import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import type { PartnerProfileRecord, PartnerType } from '@/types/partner';

export function normalizePartnerType(value: unknown): PartnerType {
  const raw = String(value || '').trim();
  if (raw === 'agency' || raw === 'transport') {
    return raw;
  }
  return 'hotel';
}

export function normalizePartnerProfile(
  uid: string,
  data: Record<string, unknown>,
): PartnerProfileRecord {
  return {
    uid,
    companyName: String(data.companyName || data.fullName || 'Partenaire PROTAXI'),
    partnerType: normalizePartnerType(data.partnerType),
    contactName: String(data.contactName || data.fullName || 'Contact partenaire'),
    phone: String(data.phone || ''),
    email: String(data.email || ''),
    isActive: Boolean(data.isActive ?? true),
    createdAt: data.createdAt,
  };
}

export function getPartnerDisplayName(profile: PartnerProfileRecord) {
  return profile.companyName.trim() || profile.contactName.trim() || 'Partenaire PROTAXI';
}

export function buildPartnerReservationFields(partnerId: string, partnerName: string) {
  return {
    partnerId: partnerId.trim(),
    partnerName: partnerName.trim(),
  };
}

export function pickPartnerFieldsFromParams(
  params: Record<string, string | string[] | undefined>,
) {
  const partnerId = String(
    Array.isArray(params.partnerId) ? params.partnerId[0] : params.partnerId || '',
  ).trim();
  const partnerName = String(
    Array.isArray(params.partnerName) ? params.partnerName[0] : params.partnerName || '',
  ).trim();

  if (!partnerId) {
    return {};
  }

  return buildPartnerReservationFields(
    partnerId,
    partnerName || 'Partenaire PROTAXI',
  );
}

export function getPartnerTypeLabel(type: PartnerType) {
  switch (type) {
    case 'agency':
      return 'Agence';
    case 'transport':
      return 'Transport';
    default:
      return 'Hôtel';
  }
}

export async function fetchPartnerProfile(uid: string): Promise<PartnerProfileRecord | null> {
  const normalizedUid = uid.trim();
  if (!normalizedUid) {
    return null;
  }

  const snapshot = await getDoc(doc(db, 'partners', normalizedUid));

  if (!snapshot.exists()) {
    return null;
  }

  return normalizePartnerProfile(
    normalizedUid,
    snapshot.data() as Record<string, unknown>,
  );
}
