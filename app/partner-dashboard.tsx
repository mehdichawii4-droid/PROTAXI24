import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import { useAuthLogout } from '@/hooks/useAuthLogout';
import {
  getPartnerDisplayName,
  getPartnerTypeLabel,
  normalizePartnerProfile,
} from '@/services/partnerService';
import type { PartnerReservationItem } from '@/types/partner';
import { devError, devLog } from '@/utils/devLog';
import { PROTAXI_ROUTES } from '@/utils/navigation';

const bg = '#050505';
const card = '#0E0E0E';
const border = '#262626';
const green = '#8BC53F';
const muted = '#8A8A8A';

function toCreatedAtMs(value: unknown): number {
  if (!value) return 0;

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateLabel(value: unknown, fallback = '—') {
  const ms = toCreatedAtMs(value);
  if (!ms) return fallback;

  return new Date(ms).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function mapRideToPartnerItem(
  id: string,
  data: Record<string, unknown>,
): PartnerReservationItem {
  const destination = String(data.destination || data.airport || 'Transfert');
  const departure = String(data.departure || data.address || '');
  const guestName = String(data.clientName || data.client || '').trim();

  return {
    id,
    kind: 'transfer',
    title: guestName || String(data.service || 'Transfert PROTAXI'),
    subtitle: departure ? `${departure} → ${destination}` : destination,
    status: String(data.status || 'En attente'),
    dateLabel: String(data.date || formatDateLabel(data.createdAt)),
    priceLabel: String(data.price || '—'),
    createdAtMs: toCreatedAtMs(data.createdAt),
  };
}

function mapTourBookingToPartnerItem(
  id: string,
  data: Record<string, unknown>,
): PartnerReservationItem {
  const guestName = String(data.clientName || '').trim();

  return {
    id,
    kind: 'excursion',
    title: guestName || String(data.experience || data.circuitName || 'Excursion'),
    subtitle: String(data.meetingPoint || data.formula || 'Tourisme PROTAXI'),
    status: String(data.status || 'pending'),
    dateLabel: String(data.date || formatDateLabel(data.createdAt)),
    priceLabel: data.price ? `${data.price} DA` : '—',
    createdAtMs: toCreatedAtMs(data.createdAt),
  };
}

export default function PartnerDashboardScreen() {
  const { user, profile, role } = useAuth();
  const { confirmLogout } = useAuthLogout();
  const [rides, setRides] = useState<PartnerReservationItem[]>([]);
  const [bookings, setBookings] = useState<PartnerReservationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const partnerId = user?.uid ?? '';
  const partnerProfile = useMemo(
    () =>
      normalizePartnerProfile(partnerId, {
        companyName: profile?.companyName,
        partnerType: profile?.partnerType,
        contactName: profile?.contactName || profile?.fullName,
        phone: profile?.phone,
        email: profile?.email,
        isActive: profile?.isApproved,
      }),
    [partnerId, profile],
  );
  const partnerName = getPartnerDisplayName(partnerProfile);

  useEffect(() => {
    if (!partnerId || role !== 'partner') {
      setRides([]);
      setBookings([]);
      setLoading(false);
      return undefined;
    }

    devLog('[PARTNER DASHBOARD] mount', {
      partnerId,
      partnerName,
      partnerType: partnerProfile.partnerType,
    });

    setLoading(true);

    const ridesQuery = query(
      collection(db, 'rides'),
      where('partnerId', '==', partnerId),
      orderBy('createdAt', 'desc'),
    );

    const bookingsQuery = query(
      collection(db, 'tourBookings'),
      where('partnerId', '==', partnerId),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribeRides = onSnapshot(
      ridesQuery,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) =>
          mapRideToPartnerItem(docSnap.id, docSnap.data() as Record<string, unknown>),
        );
        devLog('[PARTNER DASHBOARD] rides snapshot', { count: items.length });
        setRides(items);
        setLoading(false);
      },
      (error) => {
        devError('[PARTNER DASHBOARD] rides snapshot denied', error);
        setRides([]);
        setLoading(false);
      },
    );

    const unsubscribeBookings = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) =>
          mapTourBookingToPartnerItem(docSnap.id, docSnap.data() as Record<string, unknown>),
        );
        devLog('[PARTNER DASHBOARD] tourBookings snapshot', { count: items.length });
        setBookings(items);
      },
      (error) => {
        devError('[PARTNER DASHBOARD] tourBookings snapshot denied', error);
        setBookings([]);
      },
    );

    return () => {
      unsubscribeRides();
      unsubscribeBookings();
    };
  }, [partnerId, partnerName, partnerProfile.partnerType, role]);

  const reservations = useMemo(() => {
    return [...rides, ...bookings].sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [rides, bookings]);

  const stats = useMemo(
    () => ({
      total: reservations.length,
      transfers: rides.length,
      excursions: bookings.length,
    }),
    [reservations.length, rides.length, bookings.length],
  );

  const openNewReservation = () => {
    devLog('[PARTNER DASHBOARD] navigate new booking', { partnerId, partnerName });
    router.push('/partner-new-booking');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.badge}>
              <MaterialCommunityIcons name="handshake-outline" size={14} color={green} />
              <Text style={styles.badgeText}>Espace partenaire V1</Text>
            </View>
            <TouchableOpacity onPress={confirmLogout} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.companyName}>{partnerName}</Text>
          <Text style={styles.subtitle}>
            {getPartnerTypeLabel(partnerProfile.partnerType)} · {partnerProfile.contactName}
          </Text>
          <Text style={styles.meta}>
            {partnerProfile.phone || 'Téléphone non renseigné'} ·{' '}
            {partnerProfile.email || 'Email non renseigné'}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Réservations créées</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.transfers}</Text>
            <Text style={styles.statLabel}>Transferts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.excursions}</Text>
            <Text style={styles.statLabel}>Excursions</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={openNewReservation}>
          <Ionicons name="add-circle-outline" size={22} color="#050505" />
          <Text style={styles.primaryBtnText}>Nouvelle réservation</Text>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mes réservations</Text>
          <Text style={styles.sectionHint}>{PROTAXI_ROUTES.partnerDashboard}</Text>
        </View>

        {loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Chargement des réservations partenaire...</Text>
          </View>
        ) : reservations.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={34} color={muted} />
            <Text style={styles.emptyTitle}>Aucune réservation liée</Text>
            <Text style={styles.emptyText}>
              Les transferts et excursions créés avec votre compte partenaire apparaîtront ici.
            </Text>
          </View>
        ) : (
          reservations.map((item) => (
            <View key={`${item.kind}-${item.id}`} style={styles.reservationCard}>
              <View style={styles.reservationTop}>
                <View style={styles.kindPill}>
                  <Ionicons
                    name={item.kind === 'transfer' ? 'car-outline' : 'compass-outline'}
                    size={14}
                    color={green}
                  />
                  <Text style={styles.kindText}>
                    {item.kind === 'transfer' ? 'Transfert' : 'Excursion'}
                  </Text>
                </View>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
              <Text style={styles.reservationTitle}>{item.title}</Text>
              <Text style={styles.reservationSubtitle}>{item.subtitle}</Text>
              <View style={styles.reservationFooter}>
                <Text style={styles.footerMeta}>{item.dateLabel}</Text>
                <Text style={styles.footerPrice}>{item.priceLabel}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: bg,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139,197,63,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.25)',
  },
  badgeText: {
    color: green,
    fontSize: 12,
    fontWeight: '700',
  },
  logoutBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: card,
  },
  companyName: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: green,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  meta: {
    color: muted,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    padding: 14,
  },
  statValue: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    color: muted,
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: green,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  primaryBtnText: {
    color: '#050505',
    fontSize: 16,
    fontWeight: '800',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionHint: {
    color: muted,
    fontSize: 12,
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  reservationCard: {
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    marginBottom: 12,
  },
  reservationTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  kindPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139,197,63,0.1)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  kindText: {
    color: green,
    fontSize: 12,
    fontWeight: '700',
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  reservationTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  reservationSubtitle: {
    color: muted,
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  reservationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  footerMeta: {
    color: muted,
    fontSize: 12,
    fontWeight: '600',
  },
  footerPrice: {
    color: green,
    fontSize: 13,
    fontWeight: '800',
  },
});
