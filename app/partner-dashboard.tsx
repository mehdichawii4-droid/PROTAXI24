import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '@/firebaseConfig';
import type { PartnerStatus } from '@/firebase/types';
import { useAuth } from '@/hooks/useAuth';
import { fetchMyPartnerProfile, getPartnerSelfErrorMessage } from '@/services/partnerSelfService';
import type { PartnerSelfProfile } from '@/types/partner';
import type { PartnerReservationItem } from '@/types/partner';
import { devError, devLog } from '@/utils/devLog';
import {
  formatPartnerTimestamp,
  formatShortDescription,
  isPartnerOperational,
} from '@/utils/partnerSelfProfileDisplay';
import { PROTAXI_ROUTES } from '@/utils/navigation';

const bg = '#050505';
const card = '#0E0E0E';
const border = '#262626';
const green = '#8BC53F';
const gold = '#D4A017';
const muted = '#8A8A8A';
const red = '#FF5A5A';

function normalizeRegisteredParam(value: string | string[] | undefined): boolean {
  if (value === '1') return true;
  if (Array.isArray(value)) return value[0] === '1';
  return false;
}

function getStatusStyle(status: PartnerStatus) {
  switch (status) {
    case 'active':
      return { pill: styles.statusActive, text: styles.statusTextActive };
    case 'suspended':
      return { pill: styles.statusSuspended, text: styles.statusTextSuspended };
    case 'pending_review':
      return { pill: styles.statusPending, text: styles.statusTextPending };
    default:
      return { pill: styles.statusDraft, text: styles.statusTextMuted };
  }
}

function getStatusHint(status: PartnerStatus): string | null {
  switch (status) {
    case 'pending_review':
      return 'Profil en attente de validation — les réservations partenaire seront disponibles après activation.';
    case 'active':
      return 'Partenaire validé — vous pouvez créer des réservations pour vos clients.';
    case 'suspended':
      return 'Compte suspendu — contactez le support PROTAXI.';
    case 'draft':
      return 'Complétez et envoyez votre profil en validation depuis « Modifier mon profil ».';
    default:
      return null;
  }
}

function DashboardInfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon} size={16} color={gold} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

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
  if (value instanceof Date) return value.getTime();
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
  const { user, logout } = useAuth();
  const { registered } = useLocalSearchParams<{ registered?: string | string[] }>();
  const showRegisteredBanner = normalizeRegisteredParam(registered);

  const [partner, setPartner] = useState<PartnerSelfProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [rides, setRides] = useState<PartnerReservationItem[]>([]);
  const [bookings, setBookings] = useState<PartnerReservationItem[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);

  const partnerId = user?.uid ?? '';
  const canOperate = partner ? isPartnerOperational(partner.status) : false;

  const loadProfile = useCallback(async () => {
    const uid = user?.uid;
    if (!uid) {
      setPartner(null);
      setProfileError('Session partenaire introuvable. Reconnectez-vous.');
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    setProfileError(null);

    try {
      const profile = await fetchMyPartnerProfile(uid);
      if (!profile) {
        setPartner(null);
        setProfileError('Profil hôtel introuvable. Contactez le support PROTAXI.');
        return;
      }
      setPartner(profile);
    } catch (err) {
      setPartner(null);
      setProfileError(getPartnerSelfErrorMessage(err));
    } finally {
      setProfileLoading(false);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  useEffect(() => {
    if (!partnerId || !canOperate) {
      setRides([]);
      setBookings([]);
      setReservationsLoading(false);
      return undefined;
    }

    setReservationsLoading(true);

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
        setRides(
          snapshot.docs.map((docSnap) =>
            mapRideToPartnerItem(docSnap.id, docSnap.data() as Record<string, unknown>),
          ),
        );
        setReservationsLoading(false);
      },
      (error) => {
        devError('[PARTNER DASHBOARD] rides snapshot denied', error);
        setRides([]);
        setReservationsLoading(false);
      },
    );

    const unsubscribeBookings = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        setBookings(
          snapshot.docs.map((docSnap) =>
            mapTourBookingToPartnerItem(docSnap.id, docSnap.data() as Record<string, unknown>),
          ),
        );
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
  }, [partnerId, canOperate]);

  const reservations = useMemo(
    () => [...rides, ...bookings].sort((a, b) => b.createdAtMs - a.createdAtMs),
    [rides, bookings],
  );

  const stats = useMemo(
    () => ({
      total: reservations.length,
      transfers: rides.length,
      excursions: bookings.length,
    }),
    [reservations.length, rides.length, bookings.length],
  );

  const statusStyle = partner ? getStatusStyle(partner.status) : null;
  const statusHint = partner ? getStatusHint(partner.status) : null;

  const openNewReservation = () => {
    if (!canOperate) return;
    devLog('[PARTNER DASHBOARD] navigate new booking', { partnerId });
    router.push(PROTAXI_ROUTES.partnerNewBooking);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="domain" size={32} color={gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Espace hôtel partenaire</Text>
            <Text style={styles.headerSubtitle}>Votre établissement et activité PROTAXI</Text>
          </View>
        </View>

        {showRegisteredBanner ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={22} color={green} />
            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>Profil en attente de validation</Text>
              <Text style={styles.successText}>
                Votre établissement a bien été enregistré. L&apos;équipe PROTAXI valide votre
                dossier avant activation des réservations.
              </Text>
            </View>
            <MaterialCommunityIcons name="clock-outline" size={20} color={gold} />
          </View>
        ) : null}

        {profileLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={gold} />
            <Text style={styles.loadingText}>Chargement de votre profil…</Text>
          </View>
        ) : null}

        {!profileLoading && profileError ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={22} color={red} />
            <Text style={styles.errorText}>{profileError}</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => void loadProfile()}>
              <Text style={styles.secondaryBtnText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!profileLoading && partner ? (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroName}>{partner.companyName}</Text>
              {statusStyle ? (
                <View style={[styles.statusPill, statusStyle.pill]}>
                  <Text style={[styles.statusPillText, statusStyle.text]}>
                    {partner.statusLabel}
                  </Text>
                </View>
              ) : null}
              {statusHint ? (
                <Text
                  style={[
                    styles.heroHint,
                    partner.status === 'suspended' && { color: '#FFB4B4' },
                    partner.status === 'active' && { color: '#B8D4A0' },
                  ]}
                >
                  {statusHint}
                </Text>
              ) : null}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Résumé du profil</Text>
              <DashboardInfoRow
                icon="person-outline"
                label="Contact"
                value={partner.contactName}
              />
              <DashboardInfoRow
                icon="call-outline"
                label="Téléphone"
                value={partner.phone || '—'}
              />
              <DashboardInfoRow
                icon="document-text-outline"
                label="Description"
                value={formatShortDescription(partner.description)}
              />
              {partner.city || partner.address ? (
                <DashboardInfoRow
                  icon="location-outline"
                  label="Localisation"
                  value={[partner.address, partner.city].filter(Boolean).join(', ') || '—'}
                />
              ) : null}
              {partner.status === 'active' && partner.validatedAt ? (
                <DashboardInfoRow
                  icon="shield-checkmark-outline"
                  label="Validé le"
                  value={formatPartnerTimestamp(partner.validatedAt)}
                />
              ) : null}
              <DashboardInfoRow
                icon="time-outline"
                label="Dernière mise à jour"
                value={formatPartnerTimestamp(partner.updatedAt)}
              />
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              onPress={() => router.push(PROTAXI_ROUTES.partnerProfile)}
            >
              <Ionicons name="create-outline" size={18} color="#111" />
              <Text style={styles.primaryBtnText}>Modifier mon profil</Text>
            </TouchableOpacity>

            <Pressable style={styles.logoutBtn} onPress={() => void logout()}>
              <Ionicons name="log-out-outline" size={18} color={gold} />
              <Text style={styles.logoutBtnText}>Déconnexion</Text>
            </Pressable>

            {!canOperate ? (
              <View style={styles.lockedCard}>
                <Ionicons name="lock-closed-outline" size={22} color={gold} />
                <Text style={styles.lockedTitle}>Réservations non disponibles</Text>
                <Text style={styles.lockedText}>
                  La création de réservations partenaire est réservée aux établissements au statut
                  actif.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats.total}</Text>
                    <Text style={styles.statLabel}>Réservations</Text>
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

                <TouchableOpacity style={styles.reserveBtn} onPress={openNewReservation}>
                  <Ionicons name="add-circle-outline" size={22} color="#050505" />
                  <Text style={styles.reserveBtnText}>Nouvelle réservation</Text>
                </TouchableOpacity>

                <Text style={styles.reservationsTitle}>Mes réservations</Text>

                {reservationsLoading ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>Chargement des réservations…</Text>
                  </View>
                ) : reservations.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <MaterialCommunityIcons
                      name="calendar-blank-outline"
                      size={34}
                      color={muted}
                    />
                    <Text style={styles.emptyTitle}>Aucune réservation</Text>
                    <Text style={styles.emptyText}>
                      Créez une réservation transfert ou excursion pour vos clients.
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
                        <Text style={styles.reservationStatus}>{item.status}</Text>
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
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: bg },
  scroll: { padding: 20, paddingBottom: 40, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  headerSubtitle: { color: muted, fontSize: 13, marginTop: 4 },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(139,197,63,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
  },
  successTitle: { color: '#FFF', fontSize: 14, fontWeight: '900', marginBottom: 4 },
  successText: { color: '#B8D4A0', fontSize: 12, lineHeight: 17 },
  loadingWrap: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  loadingText: { color: muted, fontSize: 14, fontWeight: '600' },
  errorCard: {
    backgroundColor: 'rgba(255,90,90,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,90,90,0.35)',
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  errorText: { color: '#FFB4B4', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  heroCard: {
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.25)',
    padding: 18,
    gap: 10,
  },
  heroName: { color: '#FFF', fontSize: 24, fontWeight: '900' },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillText: { fontSize: 12, fontWeight: '900' },
  statusActive: {
    backgroundColor: 'rgba(139,197,63,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.4)',
  },
  statusTextActive: { color: green },
  statusPending: {
    backgroundColor: 'rgba(212,160,23,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.4)',
  },
  statusTextPending: { color: gold },
  statusSuspended: {
    backgroundColor: 'rgba(255,90,90,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,90,0.35)',
  },
  statusTextSuspended: { color: red },
  statusDraft: {
    backgroundColor: 'rgba(138,138,138,0.12)',
    borderWidth: 1,
    borderColor: border,
  },
  statusTextMuted: { color: muted },
  heroHint: { color: muted, fontSize: 13, lineHeight: 18 },
  sectionCard: {
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    gap: 4,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  infoLabel: { color: muted, fontSize: 13, fontWeight: '700' },
  infoValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1.2,
    textAlign: 'right',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: green,
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryBtnText: { color: '#111', fontSize: 15, fontWeight: '900' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
    backgroundColor: 'rgba(212,160,23,0.06)',
    paddingVertical: 12,
  },
  logoutBtnText: { color: gold, fontSize: 14, fontWeight: '800' },
  secondaryBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryBtnText: { color: '#FFF', fontWeight: '700' },
  lockedCard: {
    backgroundColor: 'rgba(212,160,23,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.3)',
    padding: 18,
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  lockedTitle: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  lockedText: { color: muted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  statCard: {
    flex: 1,
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    padding: 14,
  },
  statValue: { color: '#FFF', fontSize: 24, fontWeight: '900' },
  statLabel: { color: muted, fontSize: 11, marginTop: 6, fontWeight: '600' },
  reserveBtn: {
    backgroundColor: green,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reserveBtnText: { color: '#050505', fontSize: 16, fontWeight: '800' },
  reservationsTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
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
  emptyTitle: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  emptyText: { color: muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
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
  kindText: { color: green, fontSize: 12, fontWeight: '700' },
  reservationStatus: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  reservationTitle: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  reservationSubtitle: { color: muted, fontSize: 13, marginTop: 6, lineHeight: 18 },
  reservationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  footerMeta: { color: muted, fontSize: 12, fontWeight: '600' },
  footerPrice: { color: green, fontSize: 13, fontWeight: '800' },
});
