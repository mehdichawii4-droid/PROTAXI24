import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { getTourBookingsCollectionRef } from '@/firebase/firestore';
import {
  getPartnerDisplayName,
  getPartnerTypeLabel,
  normalizePartnerProfile,
} from '@/services/partnerService';
import type { AdminPartnerDetail, AdminPartnerListItem } from '@/types/partner';
import { devError, devLog } from '@/utils/devLog';

type PartnerStats = {
  totalBookings: number;
  totalRevenue: number;
};

const statsCache = new Map<string, PartnerStats>();

export function parsePartnerPrice(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const raw = String(value || '').trim();
  if (!raw || raw.toLowerCase().includes('devis') || raw.toLowerCase().includes('confirmation')) {
    return 0;
  }

  const parsed = Number(raw.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function getPartnerStatusLabel(isActive: boolean) {
  return isActive ? 'Actif' : 'Suspendu';
}

function emptyStats(): PartnerStats {
  return { totalBookings: 0, totalRevenue: 0 };
}

function mapPartnerListItem(
  uid: string,
  data: Record<string, unknown>,
  stats: PartnerStats,
): AdminPartnerListItem {
  const profile = normalizePartnerProfile(uid, data);

  return {
    uid: profile.uid,
    companyName: getPartnerDisplayName(profile),
    contactName: profile.contactName,
    phone: profile.phone,
    email: profile.email,
    partnerType: profile.partnerType,
    partnerTypeLabel: getPartnerTypeLabel(profile.partnerType),
    isActive: profile.isActive,
    statusLabel: getPartnerStatusLabel(profile.isActive),
    totalBookings: stats.totalBookings,
    totalRevenue: stats.totalRevenue,
    createdAt: profile.createdAt,
  };
}

function accumulatePartnerStats(
  partnerId: string,
  priceValue: unknown,
  target: Map<string, PartnerStats>,
) {
  const normalizedPartnerId = partnerId.trim();
  if (!normalizedPartnerId) return;

  const current = target.get(normalizedPartnerId) ?? emptyStats();
  current.totalBookings += 1;
  current.totalRevenue += parsePartnerPrice(priceValue);
  target.set(normalizedPartnerId, current);
}

export async function rebuildPartnerStatsCache(): Promise<Map<string, PartnerStats>> {
  const nextStats = new Map<string, PartnerStats>();

  try {
    const [ridesSnapshot, bookingsSnapshot] = await Promise.all([
      getDocs(collection(db, 'rides')),
      getDocs(getTourBookingsCollectionRef()),
    ]);

    ridesSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const partnerId = String(data.partnerId || '').trim();
      if (!partnerId) return;
      accumulatePartnerStats(partnerId, data.price, nextStats);
    });

    bookingsSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const partnerId = String(data.partnerId || '').trim();
      if (!partnerId) return;
      accumulatePartnerStats(partnerId, data.price, nextStats);
    });

    statsCache.clear();
    nextStats.forEach((value, key) => statsCache.set(key, value));

    devLog('[ADMIN PARTNERS] stats cache rebuilt', {
      partnersWithBookings: nextStats.size,
    });
  } catch (error) {
    devError('[ADMIN PARTNERS] stats cache rebuild failed', error);
  }

  return nextStats;
}

export function subscribePartnersWithStats(
  onChange: (partners: AdminPartnerListItem[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  let partnerRows: AdminPartnerListItem[] = [];
  let statsRevision = 0;

  const publish = () => {
    onChange(partnerRows);
  };

  const refreshStats = async () => {
    const revision = ++statsRevision;
    await rebuildPartnerStatsCache();
    if (revision !== statsRevision) return;

    partnerRows = partnerRows.map((row) => {
      const stats = statsCache.get(row.uid) ?? emptyStats();
      return {
        ...row,
        totalBookings: stats.totalBookings,
        totalRevenue: stats.totalRevenue,
      };
    });
    publish();
  };

  const unsubscribePartners = onSnapshot(
    collection(db, 'partners'),
    (snapshot) => {
      partnerRows = snapshot.docs
        .map((docSnap) => {
          const stats = statsCache.get(docSnap.id) ?? emptyStats();
          return mapPartnerListItem(
            docSnap.id,
            docSnap.data() as Record<string, unknown>,
            stats,
          );
        })
        .sort((a, b) => a.companyName.localeCompare(b.companyName, 'fr'));

      devLog('[ADMIN PARTNERS] partners snapshot', { count: partnerRows.length });
      publish();
      void refreshStats();
    },
    (error) => {
      devError('[ADMIN PARTNERS] partners snapshot denied', error);
      onError?.(error);
    },
  );

  return () => {
    statsRevision += 1;
    unsubscribePartners();
  };
}

export async function fetchPartnerDetail(partnerId: string): Promise<AdminPartnerDetail | null> {
  const normalizedPartnerId = partnerId.trim();
  if (!normalizedPartnerId) return null;

  const snapshot = await getDoc(doc(db, 'partners', normalizedPartnerId));
  if (!snapshot.exists()) return null;

  const [ridesSnapshot, bookingsSnapshot] = await Promise.all([
    getDocs(
      query(
        collection(db, 'rides'),
        where('partnerId', '==', normalizedPartnerId),
        orderBy('createdAt', 'desc'),
      ),
    ),
    getDocs(
      query(
        getTourBookingsCollectionRef(),
        where('partnerId', '==', normalizedPartnerId),
        orderBy('createdAt', 'desc'),
      ),
    ),
  ]);

  let totalBookings = 0;
  let totalRevenue = 0;

  const recentBookings = [
    ...ridesSnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const price = parsePartnerPrice(data.price);
      totalBookings += 1;
      totalRevenue += price;

      return {
        id: docSnap.id,
        kind: 'transfer' as const,
        title: String(data.clientName || data.service || 'Transfert'),
        subtitle: `${String(data.departure || data.address || '—')} → ${String(data.destination || '—')}`,
        status: String(data.status || 'En attente'),
        priceLabel: price > 0 ? `${price.toLocaleString('fr-FR')} DA` : '—',
      };
    }),
    ...bookingsSnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const price = parsePartnerPrice(data.price);
      totalBookings += 1;
      totalRevenue += price;

      return {
        id: docSnap.id,
        kind: 'excursion' as const,
        title: String(data.clientName || data.experience || data.circuitName || 'Excursion'),
        subtitle: String(data.meetingPoint || data.experience || 'Tourisme PROTAXI'),
        status: String(data.status || 'pending'),
        priceLabel: price > 0 ? `${price.toLocaleString('fr-FR')} DA` : '—',
      };
    }),
  ].slice(0, 5);

  const profile = normalizePartnerProfile(
    normalizedPartnerId,
    snapshot.data() as Record<string, unknown>,
  );

  return {
    uid: profile.uid,
    companyName: getPartnerDisplayName(profile),
    contactName: profile.contactName,
    phone: profile.phone,
    email: profile.email,
    partnerType: profile.partnerType,
    partnerTypeLabel: getPartnerTypeLabel(profile.partnerType),
    isActive: profile.isActive,
    statusLabel: getPartnerStatusLabel(profile.isActive),
    totalBookings,
    totalRevenue,
    createdAt: profile.createdAt,
    recentBookings,
  };
}

export async function setPartnerActive(partnerId: string, isActive: boolean) {
  const normalizedPartnerId = partnerId.trim();
  if (!normalizedPartnerId) {
    throw new Error('partnerId is required');
  }

  await updateDoc(doc(db, 'partners', normalizedPartnerId), {
    isActive,
    updatedAt: serverTimestamp(),
  });

  devLog('[ADMIN PARTNERS] partner status updated', {
    partnerId: normalizedPartnerId,
    isActive,
  });
}

export function formatPartnerRevenue(value: number) {
  return `${Math.round(value).toLocaleString('fr-FR')} DA`;
}
