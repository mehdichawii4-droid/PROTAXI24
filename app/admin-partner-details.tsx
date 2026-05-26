import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  fetchPartnerDetail,
  formatPartnerRevenue,
  setPartnerActive,
} from '@/services/adminPartnerService';
import type { AdminPartnerDetail } from '@/types/partner';
import { devError, devLog } from '@/utils/devLog';

const bg = '#050505';
const card = '#0E0E0E';
const border = '#262626';
const green = '#8BC53F';
const muted = '#8A8A8A';
const red = '#FF5A5A';

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function AdminPartnerDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const partnerId = normalizeParam(params.id);

  const [partner, setPartner] = useState<AdminPartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadPartner = useCallback(async () => {
    if (!partnerId) {
      setPartner(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      devLog('[ADMIN PARTNERS] load details', { partnerId });
      const detail = await fetchPartnerDetail(partnerId);
      setPartner(detail);
    } catch (error) {
      devError('[ADMIN PARTNERS] load details failed', error);
      setPartner(null);
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    void loadPartner();
  }, [loadPartner]);

  const handleSetActive = (isActive: boolean) => {
    if (!partnerId || !partner) return;

    const actionLabel = isActive ? 'activer' : 'suspendre';

    Alert.alert(
      isActive ? 'Activer le partenaire' : 'Suspendre le partenaire',
      `Confirmer ${actionLabel} ${partner.companyName} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: isActive ? 'default' : 'destructive',
          onPress: () => {
            void (async () => {
              setUpdating(true);
              try {
                await setPartnerActive(partnerId, isActive);
                await loadPartner();
              } catch (error) {
                devError('[ADMIN PARTNERS] status update failed', error);
                Alert.alert('Erreur', 'Impossible de mettre à jour le statut partenaire.');
              } finally {
                setUpdating(false);
              }
            })();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={green} />
          <Text style={styles.loadingText}>Chargement du partenaire...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!partner) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <Text style={styles.errorTitle}>Partenaire introuvable</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>{partner.companyName}</Text>
          <Text style={styles.subtitle}>{partner.partnerTypeLabel} · {partner.contactName}</Text>
          <View
            style={[
              styles.statusPill,
              partner.isActive ? styles.statusActive : styles.statusSuspended,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                partner.isActive ? styles.statusTextActive : styles.statusTextSuspended,
              ]}
            >
              {partner.statusLabel}
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <InfoRow label="Téléphone" value={partner.phone || '—'} />
          <InfoRow label="Email" value={partner.email || '—'} />
          <InfoRow label="UID" value={partner.uid} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{partner.totalBookings}</Text>
            <Text style={styles.statLabel}>Réservations</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatPartnerRevenue(partner.totalRevenue)}</Text>
            <Text style={styles.statLabel}>Revenu estimé</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.activateBtn, updating && styles.actionBtnDisabled]}
            disabled={updating || partner.isActive}
            onPress={() => handleSetActive(true)}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#050505" />
            <Text style={styles.activateBtnText}>Activer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.suspendBtn, updating && styles.actionBtnDisabled]}
            disabled={updating || !partner.isActive}
            onPress={() => handleSetActive(false)}
          >
            <Ionicons name="pause-circle-outline" size={18} color="#FFF" />
            <Text style={styles.suspendBtnText}>Suspendre</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Dernières réservations</Text>

        {partner.recentBookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={30} color={muted} />
            <Text style={styles.emptyText}>Aucune réservation liée à ce partenaire.</Text>
          </View>
        ) : (
          partner.recentBookings.map((booking) => (
            <View key={`${booking.kind}-${booking.id}`} style={styles.bookingCard}>
              <View style={styles.bookingTop}>
                <Text style={styles.bookingKind}>
                  {booking.kind === 'transfer' ? 'Transfert' : 'Excursion'}
                </Text>
                <Text style={styles.bookingStatus}>{booking.status}</Text>
              </View>
              <Text style={styles.bookingTitle}>{booking.title}</Text>
              <Text style={styles.bookingSubtitle}>{booking.subtitle}</Text>
              <Text style={styles.bookingPrice}>{booking.priceLabel}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: {
    color: muted,
    fontSize: 14,
    fontWeight: '600',
  },
  errorTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: card,
    marginBottom: 16,
  },
  header: {
    marginBottom: 18,
  },
  title: {
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
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  statusActive: {
    backgroundColor: 'rgba(139,197,63,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
  },
  statusSuspended: {
    backgroundColor: 'rgba(255,90,90,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,90,0.35)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusTextActive: {
    color: green,
  },
  statusTextSuspended: {
    color: red,
  },
  infoCard: {
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    marginBottom: 14,
    gap: 12,
  },
  infoRow: {
    gap: 4,
  },
  infoLabel: {
    color: muted,
    fontSize: 11,
    fontWeight: '700',
  },
  infoValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    padding: 14,
  },
  statValue: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    color: muted,
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  activateBtn: {
    backgroundColor: green,
  },
  activateBtnText: {
    color: '#050505',
    fontSize: 14,
    fontWeight: '800',
  },
  suspendBtn: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: border,
  },
  suspendBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtn: {
    marginTop: 8,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  secondaryBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  bookingCard: {
    backgroundColor: card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    padding: 14,
    marginBottom: 10,
  },
  bookingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bookingKind: {
    color: green,
    fontSize: 12,
    fontWeight: '800',
  },
  bookingStatus: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  bookingTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  bookingSubtitle: {
    color: muted,
    fontSize: 12,
    marginTop: 4,
  },
  bookingPrice: {
    color: green,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: muted,
    fontSize: 13,
    textAlign: 'center',
  },
});
