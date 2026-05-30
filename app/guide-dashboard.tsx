import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
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

import { useAuth } from '@/hooks/useAuth';
import { fetchMyGuideProfile } from '@/services/guideSelfService';
import { getGuideSelfErrorMessage } from '@/services/guideSelfService';
import type { GuideSelfProfile } from '@/types/guide';
import type { GuideStatus } from '@/firebase/types';
import {
  formatGuideExperienceLabels,
  formatGuideTimestamp,
} from '@/utils/guideSelfProfileDisplay';
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

function getStatusStyle(status: GuideStatus) {
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
        <Ionicons name={icon} size={16} color={green} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

export default function GuideDashboardScreen() {
  const { user, logout } = useAuth();
  const { registered } = useLocalSearchParams<{ registered?: string | string[] }>();
  const showRegisteredBanner = normalizeRegisteredParam(registered);

  const [guide, setGuide] = useState<GuideSelfProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    const uid = user?.uid;
    if (!uid) {
      setGuide(null);
      setError('Session guide introuvable. Reconnectez-vous.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const profile = await fetchMyGuideProfile(uid);
      if (!profile) {
        setGuide(null);
        setError('Profil guide introuvable. Contactez le support PROTAXI.');
        return;
      }
      setGuide(profile);
    } catch (err) {
      setGuide(null);
      setError(getGuideSelfErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const statusStyle = guide ? getStatusStyle(guide.status) : null;
  const experienceLabels = guide
    ? formatGuideExperienceLabels(guide.allowedExperienceIds)
    : '—';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <MaterialCommunityIcons name="account-tie-outline" size={32} color={green} />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Espace guide PROTAXI</Text>
            <Text style={styles.headerSubtitle}>Votre dossier et statut de certification</Text>
          </View>
        </View>

        {showRegisteredBanner ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={22} color={green} />
            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>Profil en attente de validation</Text>
              <Text style={styles.successText}>
                Votre dossier a été enregistré. L&apos;équipe PROTAXI le examine avant activation.
              </Text>
            </View>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={green} />
            <Text style={styles.loadingText}>Chargement de votre profil…</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={22} color={red} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => void loadProfile()}>
              <Text style={styles.secondaryBtnText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && guide ? (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroName}>{guide.displayName}</Text>
              {statusStyle ? (
                <View style={[styles.statusPill, statusStyle.pill]}>
                  <Text style={[styles.statusPillText, statusStyle.text]}>
                    {guide.statusLabel}
                  </Text>
                </View>
              ) : null}
              {guide.status === 'pending_review' ? (
                <Text style={styles.heroHint}>
                  Votre dossier est en cours de validation par PROTAXI.
                </Text>
              ) : null}
              {guide.status === 'active' ? (
                <Text style={styles.heroHint}>
                  Vous êtes guide certifié PROTAXI. Les missions vous seront assignées par
                  l&apos;équipe.
                </Text>
              ) : null}
              {guide.status === 'suspended' ? (
                <Text style={[styles.heroHint, { color: '#FFB4B4' }]}>
                  Votre profil est suspendu. Contactez le support PROTAXI.
                </Text>
              ) : null}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Résumé du profil</Text>
              <DashboardInfoRow
                icon="ribbon-outline"
                label="Spécialités"
                value={guide.specialtiesSummary}
              />
              <DashboardInfoRow
                icon="compass-outline"
                label="Expériences autorisées"
                value={experienceLabels}
              />
              {guide.status === 'active' && guide.validatedAt ? (
                <DashboardInfoRow
                  icon="shield-checkmark-outline"
                  label="Validé le"
                  value={formatGuideTimestamp(guide.validatedAt)}
                />
              ) : null}
              <DashboardInfoRow
                icon="time-outline"
                label="Dernière mise à jour"
                value={formatGuideTimestamp(guide.updatedAt)}
              />
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              onPress={() => router.push(PROTAXI_ROUTES.guideProfile)}
            >
              <Ionicons name="person-outline" size={18} color="#111" />
              <Text style={styles.primaryBtnText}>Mon profil guide</Text>
            </TouchableOpacity>

            <Pressable
              style={styles.logoutBtn}
              onPress={() => void logout()}
            >
              <Ionicons name="log-out-outline" size={18} color={gold} />
              <Text style={styles.logoutBtnText}>Déconnexion</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: bg },
  scroll: { padding: 20, paddingBottom: 40, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
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
    borderColor: 'rgba(139,197,63,0.22)',
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
    marginTop: 4,
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
});
