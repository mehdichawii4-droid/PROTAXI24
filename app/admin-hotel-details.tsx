import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchHotelDetails,
  getHotelAdminErrorMessage,
  getHotelStatusLabel,
  reactivateHotel,
  suspendHotel,
  validateHotel,
} from '@/services/adminHotelService';
import type { AdminHotelDetail } from '@/types/partner';
import { devError, devLog } from '@/utils/devLog';
import { PROTAXI_ROUTES } from '@/utils/navigation';

const bg = '#050505';
const card = '#0E0E0E';
const border = '#262626';
const green = '#8BC53F';
const gold = '#D4A017';
const muted = '#8A8A8A';
const red = '#FF5A5A';

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function showAppAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message ?? '');
}

function formatTimestampLabel(value: unknown): string {
  if (!value) return '—';
  let date: Date | null = null;
  if (value instanceof Date) date = value;
  else if (typeof value === 'object' && value !== null && 'toDate' in value) {
    date = (value as { toDate?: () => Date }).toDate?.() ?? null;
  }
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function getStatusPillStyle(status: AdminHotelDetail['status']) {
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

type StatusActionVariant = 'primary' | 'outline' | 'danger';

function StatusActionPressable({
  label,
  variant,
  isDisabled,
  onPress,
  icon,
}: {
  label: string;
  variant: StatusActionVariant;
  isDisabled: boolean;
  onPress: () => void;
  icon?: ComponentProps<typeof Ionicons>['name'];
}) {
  const baseStyle: StyleProp<ViewStyle> =
    variant === 'primary'
      ? styles.primaryBtn
      : variant === 'outline'
        ? styles.outlineBtn
        : styles.dangerBtn;

  const textStyle =
    variant === 'primary'
      ? styles.primaryBtnText
      : variant === 'outline'
        ? styles.outlineBtnText
        : styles.dangerBtnText;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        baseStyle,
        (isDisabled || pressed) && styles.btnDisabled,
        Platform.OS === 'web' && {
          cursor: isDisabled ? ('not-allowed' as const) : ('pointer' as const),
        },
      ]}
      onPress={onPress}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={18}
          color={variant === 'primary' ? '#111' : '#FFF'}
          pointerEvents="none"
        />
      ) : null}
      <Text style={textStyle} pointerEvents="none">
        {label}
      </Text>
    </Pressable>
  );
}

export default function AdminHotelDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const hotelId = normalizeParam(params.id);

  const { user, profile } = useAuth();
  const adminUid = user?.uid ?? profile?.uid ?? '';

  const [detail, setDetail] = useState<AdminHotelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const loadHotel = useCallback(async () => {
    if (!hotelId) {
      setDetail(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      devLog('[ADMIN HOTELS] load details', { hotelId });
      const loaded = await fetchHotelDetails(hotelId);
      setDetail(loaded);
    } catch (error) {
      devError('[ADMIN HOTELS] load details failed', error);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    void loadHotel();
  }, [loadHotel]);

  const confirmAction = useCallback((title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      const accepted = window.confirm(message.trim() ? `${title}\n\n${message}` : title);
      if (accepted) onConfirm();
      return;
    }

    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Confirmer', onPress: onConfirm },
    ]);
  }, []);

  const runStatusAction = useCallback(
    async (label: string, action: () => Promise<unknown>) => {
      setStatusUpdating(true);
      try {
        await action();
        await loadHotel();
        showAppAlert(label, 'Statut hôtel mis à jour.');
      } catch (error) {
        showAppAlert('Erreur', getHotelAdminErrorMessage(error));
      } finally {
        setStatusUpdating(false);
      }
    },
    [loadHotel],
  );

  const statusLabel = useMemo(() => {
    return detail ? getHotelStatusLabel(detail.status) : '—';
  }, [detail]);

  const statusStyle = detail ? getStatusPillStyle(detail.status) : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={gold} />
          <Text style={styles.loadingText}>Chargement de l&apos;hôtel…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <Text style={styles.errorTitle}>Hôtel introuvable</Text>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.replace(PROTAXI_ROUTES.adminHotels)}
          >
            <Text style={styles.secondaryBtnText}>Retour à la liste</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace(PROTAXI_ROUTES.adminHotels)}
        >
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.header}>
          <MaterialCommunityIcons name="domain" size={32} color={gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{detail.companyName}</Text>
            <Text style={styles.subtitle}>{statusLabel}</Text>
          </View>
          {statusStyle ? (
            <View style={[styles.statusPill, statusStyle.pill]}>
              <Text style={[styles.statusPillText, statusStyle.text]}>{detail.statusLabel}</Text>
            </View>
          ) : null}
        </View>

        {detail.status === 'draft' ? (
          <View style={styles.infoBanner}>
            <MaterialCommunityIcons name="information-outline" size={20} color={gold} />
            <Text style={styles.infoBannerText}>
              Dossier en brouillon — l&apos;établissement doit compléter et envoyer son profil en
              validation depuis l&apos;espace partenaire.
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Identité</Text>
          <InfoRow label="UID Auth" value={detail.uid} />
          <InfoRow label="Statut" value={detail.statusLabel} />
          <InfoRow label="Compte actif (isActive)" value={detail.isActive ? 'Oui' : 'Non'} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <InfoRow label="Contact" value={detail.contactName || '—'} />
          <InfoRow label="Téléphone" value={detail.phone || '—'} />
          <InfoRow label="Email" value={detail.email || '—'} />
          {detail.receptionPhone ? (
            <InfoRow label="Réception" value={detail.receptionPhone} />
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Établissement</Text>
          <InfoRow label="Adresse" value={detail.address || '—'} />
          <InfoRow label="Ville" value={detail.city || '—'} />
          {detail.postalCode ? <InfoRow label="Code postal" value={detail.postalCode} /> : null}
          {detail.website ? <InfoRow label="Site web" value={detail.website} /> : null}
          <Text style={styles.descriptionLabel}>Description</Text>
          <Text style={styles.descriptionBody}>
            {detail.description.trim() || '—'}
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Validation & suivi</Text>
          {detail.status === 'active' && detail.validatedAt ? (
            <InfoRow label="Validé le" value={formatTimestampLabel(detail.validatedAt)} />
          ) : (
            <InfoRow label="Validé le" value="—" />
          )}
          <InfoRow label="Validé par" value={detail.validatedBy || '—'} />
          <InfoRow label="Créé le" value={formatTimestampLabel(detail.createdAt)} />
          <InfoRow label="Dernière MAJ" value={formatTimestampLabel(detail.updatedAt)} />
        </View>

        {detail.status === 'pending_review' ? (
          <View style={styles.actionsCard}>
            <Text style={styles.actionsTitle}>Actions</Text>
            <StatusActionPressable
              label="Valider"
              variant="primary"
              isDisabled={statusUpdating || !adminUid}
              icon="checkmark-circle-outline"
              onPress={() => {
                if (statusUpdating || !adminUid) {
                  if (!adminUid) {
                    showAppAlert(
                      'Session',
                      'Identifiant administrateur indisponible. Reconnectez-vous.',
                    );
                  }
                  return;
                }
                confirmAction(
                  'Valider l\'hôtel',
                  `Activer ${detail.companyName} comme partenaire hôtel PROTAXI ?`,
                  () =>
                    void runStatusAction('Hôtel validé', () =>
                      validateHotel(detail.uid, adminUid),
                    ),
                );
              }}
            />
          </View>
        ) : null}

        {detail.status === 'active' ? (
          <View style={styles.actionsCard}>
            <Text style={styles.actionsTitle}>Actions</Text>
            <StatusActionPressable
              label="Suspendre"
              variant="danger"
              isDisabled={statusUpdating}
              icon="pause-circle-outline"
              onPress={() => {
                if (statusUpdating) return;
                confirmAction(
                  'Suspendre l\'hôtel',
                  `Suspendre ${detail.companyName} ? Les réservations et la connexion seront bloquées.`,
                  () => void runStatusAction('Hôtel suspendu', () => suspendHotel(detail.uid)),
                );
              }}
            />
          </View>
        ) : null}

        {detail.status === 'suspended' ? (
          <View style={styles.actionsCard}>
            <Text style={styles.actionsTitle}>Actions</Text>
            <StatusActionPressable
              label="Réactiver"
              variant="primary"
              isDisabled={statusUpdating || !adminUid}
              icon="refresh-outline"
              onPress={() => {
                if (statusUpdating || !adminUid) {
                  if (!adminUid) {
                    showAppAlert(
                      'Session',
                      'Identifiant administrateur indisponible. Reconnectez-vous.',
                    );
                  }
                  return;
                }
                confirmAction(
                  'Réactiver l\'hôtel',
                  `Réactiver ${detail.companyName} comme partenaire certifié ?`,
                  () =>
                    void runStatusAction('Hôtel réactivé', () =>
                      reactivateHotel(detail.uid, adminUid),
                    ),
                );
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: bg },
  scroll: { padding: 20, paddingBottom: 48 },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: { color: muted, fontSize: 14, fontWeight: '600' },
  errorTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  title: { color: '#FFF', fontSize: 24, fontWeight: '900' },
  subtitle: { color: gold, fontSize: 13, fontWeight: '700', marginTop: 4 },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  statusPillText: { fontSize: 11, fontWeight: '800' },
  statusActive: {
    backgroundColor: 'rgba(139,197,63,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
  },
  statusTextActive: { color: green },
  statusSuspended: {
    backgroundColor: 'rgba(255,90,90,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,90,0.35)',
  },
  statusTextSuspended: { color: red },
  statusPending: {
    backgroundColor: 'rgba(212,160,23,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
  },
  statusTextPending: { color: gold },
  statusDraft: {
    backgroundColor: 'rgba(138,138,138,0.12)',
    borderWidth: 1,
    borderColor: border,
  },
  statusTextMuted: { color: muted },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(212,160,23,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.3)',
    marginBottom: 14,
  },
  infoBannerText: { color: '#E8D5A8', fontSize: 12, flex: 1, lineHeight: 17 },
  sectionCard: {
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    marginBottom: 14,
    gap: 4,
  },
  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', marginBottom: 8 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  infoLabel: { color: muted, fontSize: 12, fontWeight: '700' },
  infoValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  descriptionLabel: { color: muted, fontSize: 12, fontWeight: '700', marginTop: 8 },
  descriptionBody: { color: '#D6D6D6', fontSize: 13, lineHeight: 19, marginTop: 6 },
  actionsCard: {
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.25)',
    padding: 16,
    gap: 12,
    marginBottom: 14,
  },
  actionsTitle: { color: '#FFF', fontSize: 15, fontWeight: '900' },
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
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: border,
    paddingVertical: 13,
  },
  outlineBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,90,90,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,90,0.4)',
    paddingVertical: 14,
  },
  dangerBtnText: { color: red, fontSize: 15, fontWeight: '900' },
  btnDisabled: { opacity: 0.55 },
  secondaryBtn: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryBtnText: { color: '#FFF', fontWeight: '700' },
});
