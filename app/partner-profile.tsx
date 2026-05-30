import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import HotelPartnerProfileForm from '@/components/partner/HotelPartnerProfileForm';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchMyPartnerProfile,
  getPartnerSelfErrorMessage,
  submitMyPartnerForReview,
  updateMyPartnerProfile,
} from '@/services/partnerSelfService';
import { PartnerServiceError } from '@/types/partner';
import type { PartnerSelfProfile } from '@/types/partner';
import type { HotelPartnerProfileFormValues } from '@/types/partnerProfileForm';
import {
  buildPartnerInputFromSelfProfile,
  formatPartnerTimestamp,
  isPartnerProfileEditable,
  selfProfileToFormValues,
} from '@/utils/partnerSelfProfileDisplay';
import {
  isHotelPartnerProfileFormValid,
  validateHotelPartnerProfileFormValues,
} from '@/utils/partnerProfileFormValidation';
import { PROTAXI_ROUTES } from '@/utils/navigation';

const bg = '#050505';
const card = '#0E0E0E';
const border = '#262626';
const green = '#8BC53F';
const gold = '#D4A017';
const muted = '#8A8A8A';
const red = '#FF5A5A';

function showAppAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message ?? '');
}

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    const accepted = window.confirm(message.trim() ? `${title}\n\n${message}` : title);
    if (accepted) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Confirmer', onPress: onConfirm },
  ]);
}

function ProfileInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function PartnerProfileScreen() {
  const { user } = useAuth();

  const [partner, setPartner] = useState<PartnerSelfProfile | null>(null);
  const [form, setForm] = useState<HotelPartnerProfileFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    ReturnType<typeof validateHotelPartnerProfileFormValues>
  >([]);

  const editable = partner ? isPartnerProfileEditable(partner.status) : false;
  const canSubmitForReview = partner?.status === 'draft';

  const loadProfile = useCallback(async () => {
    const uid = user?.uid;
    if (!uid) {
      setPartner(null);
      setForm(null);
      setError('Session partenaire introuvable.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const profile = await fetchMyPartnerProfile(uid);
      if (!profile) {
        setPartner(null);
        setForm(null);
        setError('Profil hôtel introuvable.');
        return;
      }
      setPartner(profile);
      setForm(selfProfileToFormValues(profile));
      setFieldErrors([]);
    } catch (err) {
      setPartner(null);
      setForm(null);
      setError(getPartnerSelfErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const handleSave = async () => {
    if (!partner || !form || !user?.uid || !editable) return;

    const errors = validateHotelPartnerProfileFormValues(form);
    setFieldErrors(errors);
    if (!isHotelPartnerProfileFormValid(form)) {
      setError('Corrigez les champs du profil avant enregistrement.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const input = buildPartnerInputFromSelfProfile(partner, form);
      const updated = await updateMyPartnerProfile(user.uid, input);
      setPartner(updated);
      setForm(selfProfileToFormValues(updated));
      showAppAlert('Enregistré', 'Votre profil hôtel a été mis à jour.');
    } catch (err) {
      if (err instanceof PartnerServiceError && err.fieldErrors?.length) {
        setFieldErrors(err.fieldErrors);
      }
      const message = getPartnerSelfErrorMessage(err);
      setError(message);
      showAppAlert('Enregistrement impossible', message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = () => {
    if (!partner || !user?.uid || !canSubmitForReview) return;

    confirmAction(
      'Envoyer en validation',
      'Soumettre votre établissement à l\'équipe PROTAXI ?',
      () => {
        void (async () => {
          setSubmitting(true);
          setError(null);
          try {
            if (form && editable) {
              const errors = validateHotelPartnerProfileFormValues(form);
              if (errors.length > 0) {
                setFieldErrors(errors);
                setError('Complétez le profil avant envoi.');
                return;
              }
              const input = buildPartnerInputFromSelfProfile(partner, form);
              await updateMyPartnerProfile(user.uid, input);
            }

            const updated = await submitMyPartnerForReview(user.uid);
            setPartner(updated);
            setForm(selfProfileToFormValues(updated));
            showAppAlert(
              'Dossier envoyé',
              'Votre établissement est maintenant en attente de validation PROTAXI.',
            );
          } catch (err) {
            const message = getPartnerSelfErrorMessage(err);
            setError(message);
            showAppAlert('Envoi impossible', message);
          } finally {
            setSubmitting(false);
          }
        })();
      },
    );
  };

  const updateForm = (patch: Partial<HotelPartnerProfileFormValues>) => {
    if (!editable || !form) return;
    setForm((current) => (current ? { ...current, ...patch } : current));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace(PROTAXI_ROUTES.partnerDashboard)}
        >
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.header}>
          <MaterialCommunityIcons name="domain" size={36} color={gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Mon profil hôtel</Text>
            <Text style={styles.subtitle}>
              {editable
                ? 'Modifiez votre dossier tant qu\'il n\'est pas certifié.'
                : 'Consultation seule — profil certifié ou suspendu.'}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={gold} />
          </View>
        ) : null}

        {error && !loading ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!loading && partner && form ? (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Identité (lecture seule)</Text>
              <ProfileInfoRow label="Type" value={partner.partnerTypeLabel} />
              <ProfileInfoRow label="Statut" value={partner.statusLabel} />
              <ProfileInfoRow label="Email compte" value={partner.email} />
              {partner.status === 'active' && partner.validatedAt ? (
                <ProfileInfoRow
                  label="Validé le"
                  value={formatPartnerTimestamp(partner.validatedAt)}
                />
              ) : null}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Profil établissement</Text>
              {!editable ? (
                <View style={styles.readOnlyBanner}>
                  <Ionicons name="lock-closed-outline" size={16} color={gold} />
                  <Text style={styles.readOnlyBannerText}>
                    Ce profil ne peut plus être modifié depuis l&apos;espace partenaire.
                  </Text>
                </View>
              ) : null}
              <HotelPartnerProfileForm
                value={form}
                onChange={updateForm}
                fieldErrors={fieldErrors}
                readOnly={!editable}
              />
            </View>

            {editable ? (
              <TouchableOpacity
                style={[styles.primaryBtn, saving && styles.btnDisabled]}
                activeOpacity={0.85}
                disabled={saving || submitting}
                onPress={() => void handleSave()}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#111" />
                ) : (
                  <Ionicons name="save-outline" size={18} color="#111" />
                )}
                <Text style={styles.primaryBtnText}>Enregistrer les modifications</Text>
              </TouchableOpacity>
            ) : null}

            {canSubmitForReview ? (
              <TouchableOpacity
                style={[styles.outlineBtn, (submitting || saving) && styles.btnDisabled]}
                activeOpacity={0.85}
                disabled={submitting || saving}
                onPress={handleSubmitForReview}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={green} />
                ) : (
                  <Ionicons name="send-outline" size={18} color={green} />
                )}
                <Text style={styles.outlineBtnText}>Envoyer en validation</Text>
              </TouchableOpacity>
            ) : null}

            {partner.status === 'pending_review' ? (
              <View style={styles.pendingBanner}>
                <MaterialCommunityIcons name="clock-outline" size={18} color={gold} />
                <Text style={styles.pendingBannerText}>
                  Dossier déjà soumis — en attente de validation PROTAXI.
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: bg },
  scroll: { padding: 20, paddingBottom: 40, gap: 14 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: card,
    marginBottom: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  subtitle: { color: muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  loadingWrap: { paddingVertical: 48, alignItems: 'center' },
  errorBanner: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,90,90,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,90,0.35)',
  },
  errorText: { color: '#FFB4B4', fontSize: 13, flex: 1, lineHeight: 18 },
  sectionCard: {
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    gap: 8,
  },
  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', marginBottom: 4 },
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
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(212,160,23,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.3)',
    marginBottom: 8,
  },
  readOnlyBannerText: { color: '#E8D5A8', fontSize: 12, flex: 1, lineHeight: 17 },
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
    borderColor: 'rgba(139,197,63,0.45)',
    backgroundColor: 'rgba(139,197,63,0.08)',
    paddingVertical: 13,
  },
  outlineBtnText: { color: green, fontSize: 14, fontWeight: '900' },
  btnDisabled: { opacity: 0.6 },
  pendingBanner: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(212,160,23,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.3)',
  },
  pendingBannerText: { color: '#E8D5A8', fontSize: 12, flex: 1, lineHeight: 17 },
});
