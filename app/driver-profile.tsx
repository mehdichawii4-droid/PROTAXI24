import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import { getFirebaseAuth } from '@/firebase/authInstance';
import { devError } from '@/utils/devLog';
import { redirectPathByRole } from '@/services/authUtils';

const gold = '#FFD700';
const card = '#0E0E0E';
const border = '#262626';

const parsePrice = (price?: string) =>
  parseInt(String(price || '0').replace(/\D/g, ''), 10) || 0;

const normalizeRideStatus = (status?: string) => {
  const value = String(status || '').toLowerCase().trim();
  if (value === 'terminée' || value === 'terminee') return 'Terminée';
  return status || '';
};

const getRideDate = (ride: any) =>
  ride.finishedAt?.toDate?.() ??
  ride.createdAt?.toDate?.() ??
  (ride.createdAt ? new Date(ride.createdAt) : null);

const formatRideDate = (ride: any) => {
  const date = getRideDate(ride);
  return date ? date.toLocaleString('fr-FR') : '—';
};

type DriverStatusLabel =
  | 'En ligne'
  | 'Hors ligne'
  | 'Occupé'
  | 'En attente validation';

const getDriverStatus = (
  isApproved: boolean,
  isOnline: boolean,
  isBusy: boolean
): DriverStatusLabel => {
  if (!isApproved) return 'En attente validation';
  if (!isOnline) return 'Hors ligne';
  if (isBusy) return 'Occupé';
  return 'En ligne';
};

const getDriverLevel = (completedCount: number, rating: number) => {
  if (completedCount >= 100 && rating >= 4.9) return '💎 Diamond';
  if (completedCount >= 50) return '🥇 Gold';
  if (completedCount >= 20) return '🥈 Silver';
  return '🥉 Bronze';
};

export default function DriverProfileScreen() {
  const params = useLocalSearchParams();
  const { user, profile } = useAuth();
  const driverId = String(
    params.driverId || user?.uid || getFirebaseAuth().currentUser?.uid || '',
  );
  const canLoadDriverRides =
    profile?.role === 'admin' || user?.uid === driverId;

  const [driverLive, setDriverLive] = useState<any | null>(null);
  const [driverRides, setDriverRides] = useState<any[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [loadingRides, setLoadingRides] = useState(canLoadDriverRides);
  const [ridesHistoryUnavailable, setRidesHistoryUnavailable] = useState(
    !canLoadDriverRides,
  );

  useEffect(() => {
    if (!driverId) {
      setDriverLive(null);
      setLoadingLive(false);
      return undefined;
    }

    setLoadingLive(true);

    const unsubscribe = onSnapshot(
      doc(db, 'driversLive', driverId),
      (snapshot) => {
        setDriverLive(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
        setLoadingLive(false);
      },
      (error) => {
        devError('[SNAPSHOT DENIED - driver-profile - driversLive]', error);
        setDriverLive(null);
        setLoadingLive(false);
      },
    );

    return unsubscribe;
  }, [driverId]);

  useEffect(() => {
    if (!driverId || !canLoadDriverRides) {
      setDriverRides([]);
      setLoadingRides(false);
      setRidesHistoryUnavailable(true);
      return undefined;
    }

    setLoadingRides(true);
    setRidesHistoryUnavailable(false);

    const driverRidesQuery = query(
      collection(db, 'rides'),
      where('driverId', '==', driverId),
    );

    const unsubscribe = onSnapshot(
      driverRidesQuery,
      (snapshot) => {
        const rides = snapshot.docs
          .map((item) => ({
            id: item.id,
            ...item.data(),
            status: normalizeRideStatus(item.data().status),
          }))
          .filter((ride: any) => ride.driverId === driverId);

        setDriverRides(rides);
        setLoadingRides(false);
        setRidesHistoryUnavailable(false);
      },
      (error) => {
        devError('[SNAPSHOT DENIED - driver-profile - rides]', error);
        setDriverRides([]);
        setLoadingRides(false);
        setRidesHistoryUnavailable(true);

        if (profile?.role === 'admin') {
          const authUid = user?.uid ?? getFirebaseAuth().currentUser?.uid ?? '';
          if (authUid) {
            void getDoc(doc(db, 'admins', authUid)).then((adminSnap) => {
              if (!adminSnap.exists()) {
                devError(
                  '[DRIVER PROFILE] admin role in app but missing Firestore admins/{uid}',
                  { uid: authUid },
                );
              }
            });
          }
        }
      },
    );

    return unsubscribe;
  }, [canLoadDriverRides, driverId, profile?.role, user?.uid]);

  const completedRides = useMemo(
    () => driverRides.filter((ride) => ride.status === 'Terminée'),
    [driverRides]
  );

  const driverProfileView = useMemo(() => {
    const isApproved = driverLive?.isApproved !== false;
    const isOnline = Boolean(driverLive?.isOnline);
    const isBusy = Boolean(driverLive?.isBusy);
    const averageRating = Number(
      params.rating ??
        driverLive?.averageRating ??
        driverLive?.rating ??
        5
    );

    return {
      fullName: String(
        params.name ??
          driverLive?.driverName ??
          driverLive?.name ??
          'Chauffeur PROTAXI'
      ),
      phone: String(
        params.phone ?? driverLive?.driverPhone ?? driverLive?.phone ?? '—'
      ),
      car: String(
        params.car ?? driverLive?.car ?? driverLive?.driverCar ?? 'Renault Clio'
      ),
      plate: String(
        params.plate ?? driverLive?.plate ?? driverLive?.driverPlate ?? '24-000-16'
      ),
      photo: String(
        params.photo ??
          driverLive?.photo ??
          driverLive?.driverPhoto ??
          ''
      ),
      city: String(params.city ?? driverLive?.city ?? 'Guelma'),
      isApproved,
      isOnline,
      isBusy,
      averageRating,
      statusLabel: getDriverStatus(isApproved, isOnline, isBusy),
      completedCount: completedRides.length,
      estimatedEarnings: completedRides.reduce(
        (sum, ride) => sum + parsePrice(ride.price),
        0
      ),
      driverLevel: getDriverLevel(completedRides.length, averageRating),
    };
  }, [params, driverLive, completedRides]);

  const recentActivity = useMemo(
    () =>
      [...completedRides]
        .sort(
          (a, b) =>
            (getRideDate(b)?.getTime() ?? 0) - (getRideDate(a)?.getTime() ?? 0)
        )
        .slice(0, 5),
    [completedRides]
  );

  const badges = useMemo(() => {
    const items = [{ label: 'PROTAXI Driver', active: true }];

    if (driverProfileView.isApproved) {
      items.unshift({ label: 'Documents validés', active: true });
    }

    if (driverProfileView.isApproved && driverProfileView.averageRating >= 4.5) {
      items.unshift({ label: 'Chauffeur vérifié', active: true });
    }

    return items;
  }, [driverProfileView.isApproved, driverProfileView.averageRating]);

  const statusStyle = useMemo(() => {
    switch (driverProfileView.statusLabel) {
      case 'En ligne':
        return styles.statusOnline;
      case 'Occupé':
        return styles.statusBusy;
      case 'En attente validation':
        return styles.statusPending;
      default:
        return styles.statusOffline;
    }
  }, [driverProfileView.statusLabel]);

  const callDriver = () => {
    if (!driverProfileView.phone || driverProfileView.phone === '—') return;
    Linking.openURL(`tel:${driverProfileView.phone}`);
  };

  const whatsappDriver = () => {
    if (!driverProfileView.phone || driverProfileView.phone === '—') return;
    const cleanPhone = driverProfileView.phone.replace('+', '').replace(/\s/g, '');
    Linking.openURL(`https://wa.me/${cleanPhone}`);
  };

  const isLoading = loadingLive || (canLoadDriverRides && loadingRides);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>PROFIL CHAUFFEUR</Text>

          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="account-tie" size={24} color={gold} />
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={gold} />
            <Text style={styles.loadingText}>Chargement du profil chauffeur...</Text>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              {driverProfileView.photo ? (
                <Image
                  source={{ uri: driverProfileView.photo }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <MaterialCommunityIcons name="account-tie" size={68} color={gold} />
              )}
            </View>
          </View>

          <Text style={styles.driverName}>{driverProfileView.fullName}</Text>
          <Text style={styles.driverId}>{driverId}</Text>

          <View style={[styles.statusBadge, statusStyle]}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{driverProfileView.statusLabel}</Text>
          </View>

          <View style={styles.badgesRow}>
            {badges.map((badge) => (
              <View key={badge.label} style={styles.badgeChip}>
                <Ionicons name="shield-checkmark" size={14} color={gold} />
                <Text style={styles.badgeText}>{badge.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.carText}>
            {driverProfileView.car} • {driverProfileView.plate}
          </Text>

          <View style={styles.ratingRow}>
            <Ionicons name="star" size={18} color={gold} />
            <Text style={styles.ratingText}>
              {driverProfileView.averageRating.toFixed(1)}/5
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            title="Courses"
            value={String(driverProfileView.completedCount)}
            icon="car-outline"
          />
          <StatCard
            title="Revenus"
            value={`${driverProfileView.estimatedEarnings.toLocaleString('fr-FR')} DA`}
            icon="cash-outline"
          />
          <StatCard
            title="Note"
            value={driverProfileView.averageRating.toFixed(1)}
            icon="star-outline"
          />
        </View>

        <View style={styles.levelCard}>
          <Text style={styles.levelTitle}>Niveau chauffeur</Text>
          <Text style={styles.levelValue}>{driverProfileView.driverLevel}</Text>
        </View>

        <View style={styles.infoCard}>
          <InfoRow icon="person-outline" label="Nom complet" value={driverProfileView.fullName} />
          <InfoRow icon="call-outline" label="Téléphone" value={driverProfileView.phone} />
          <InfoRow icon="car-outline" label="Véhicule" value={driverProfileView.car} />
          <InfoRow icon="document-text-outline" label="Plaque" value={driverProfileView.plate} />
          <InfoRow icon="location-outline" label="Ville" value={driverProfileView.city} />
          <InfoRow
            icon="radio-button-on-outline"
            label="Statut live"
            value={driverProfileView.statusLabel}
          />
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={callDriver}>
            <Ionicons name="call-outline" size={24} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={whatsappDriver}>
            <Ionicons name="logo-whatsapp" size={24} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() =>
              router.push(
                profile?.role ? redirectPathByRole(profile.role) : '/drivers-dashboard',
              )
            }
          >
            <Ionicons name="speedometer-outline" size={20} color="#111" />
            <Text style={styles.primaryBtnText}>
              {profile?.role === 'admin' ? 'Dashboard admin' : 'Mon dashboard'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.activityCard}>
          <Text style={styles.sectionTitle}>Dernières courses</Text>

          {canLoadDriverRides && loadingRides ? (
            <View style={styles.emptyActivity}>
              <ActivityIndicator size="small" color={gold} />
              <Text style={styles.emptyActivityText}>
                Chargement de l'historique...
              </Text>
            </View>
          ) : ridesHistoryUnavailable ? (
            <View style={styles.emptyActivity}>
              <Ionicons name="lock-closed-outline" size={28} color={gold} />
              <Text style={styles.emptyActivityText}>Historique indisponible</Text>
            </View>
          ) : recentActivity.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Ionicons name="time-outline" size={28} color={gold} />
              <Text style={styles.emptyActivityText}>
                Aucune course terminée pour le moment.
              </Text>
            </View>
          ) : (
            recentActivity.map((ride) => (
              <ActivityRow
                key={ride.id}
                title={ride.destination || ride.service || 'Course PROTAXI'}
                subtitle={`${ride.price || '—'} • ${formatRideDate(ride)}`}
              />
            ))
          )}
        </View>

        <View style={{ height: 45 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={24} color={gold} />
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

function InfoRow({
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
        <Ionicons name={icon} size={19} color={gold} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>

      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function ActivityRow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.activityRow}>
      <View style={styles.activityDot} />

      <View style={{ flex: 1 }}>
        <Text style={styles.activityTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.activitySubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    paddingHorizontal: 18,
  },
  header: {
    paddingTop: 55,
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#171307',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 18,
    marginBottom: 10,
  },
  loadingText: {
    color: '#AAA',
    fontSize: 13,
    marginTop: 10,
    fontWeight: '600',
  },
  heroCard: {
    backgroundColor: card,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(255,215,0,0.28)',
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  avatarRing: {
    padding: 4,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: gold,
    marginBottom: 16,
    backgroundColor: 'rgba(255,215,0,0.08)',
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#171307',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  driverName: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  driverId: {
    color: gold,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: 1,
  },
  statusBadge: {
    marginTop: 14,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
  statusOnline: {
    backgroundColor: 'rgba(74,222,128,0.15)',
  },
  statusBusy: {
    backgroundColor: 'rgba(255,149,0,0.15)',
  },
  statusOffline: {
    backgroundColor: 'rgba(180,180,180,0.15)',
  },
  statusPending: {
    backgroundColor: 'rgba(255,215,0,0.12)',
  },
  statusText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 13,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.22)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  carText: {
    color: '#AFAFAF',
    fontSize: 15,
    marginTop: 14,
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  ratingText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minHeight: 112,
    backgroundColor: card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: border,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  statValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'center',
  },
  statTitle: {
    color: '#AAA',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  levelCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: border,
    padding: 22,
    marginBottom: 20,
    alignItems: 'center',
  },
  levelTitle: {
    color: '#AAA',
    fontSize: 14,
    fontWeight: '700',
  },
  levelValue: {
    color: gold,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 10,
  },
  infoCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1C',
    paddingVertical: 15,
    gap: 12,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  infoLabel: {
    color: '#BEBEBE',
    fontSize: 13,
  },
  infoValue: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  actionBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#191919',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtn: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    backgroundColor: gold,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  primaryBtnText: {
    color: '#111',
    fontWeight: '900',
    fontSize: 13,
    textTransform: 'uppercase',
  },
  activityCard: {
    backgroundColor: card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: border,
    padding: 20,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 18,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  activityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: gold,
  },
  activityTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  activitySubtitle: {
    color: '#AFAFAF',
    fontSize: 12,
    marginTop: 4,
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyActivityText: {
    color: '#AAA',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
});
