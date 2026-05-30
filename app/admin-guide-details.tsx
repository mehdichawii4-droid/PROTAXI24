import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  GUIDE_SPECIALTY_DEFS,
  GUIDE_YEARS_EXPERIENCE_OPTIONS,
  getGuideExperiencePickerOptions,
  getGuideSpecialtyLabel,
} from '@/constants/guideCatalog';
import type { GuideExperienceId, GuideSpecialty, GuideYearsExperience } from '@/firebase/types';
import { useAuth } from '@/hooks/useAuth';
import {
  createGuide,
  fetchGuideDetail,
  getGuideAssignErrorMessage,
  reactivateGuide,
  submitGuideForReview,
  suspendGuide,
  updateGuideProfile,
  validateGuide,
} from '@/services/adminGuideService';
import { getGuideStatusLabel } from '@/services/guideService';
import type { AdminGuideDetail, GuideFormInput } from '@/types/guide';
import { devError, devLog } from '@/utils/devLog';

const bg = '#050505';
const card = '#0E0E0E';
const border = '#262626';
const green = '#8BC53F';
const gold = '#D4A017';
const muted = '#8A8A8A';
const red = '#FF5A5A';

const LANGUAGE_PRESETS = ['fr', 'ar', 'en'] as const;
const BIO_MIN = 50;
const BIO_MAX = 300;
const MAX_SPECIALTIES = 3;

const EXPERIENCE_OPTIONS = getGuideExperiencePickerOptions();

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
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

function emptyForm(guideUid = ''): GuideFormInput {
  return {
    guideUid,
    displayName: '',
    phone: '',
    email: '',
    bio: '',
    languages: ['fr'],
    specialties: [],
    yearsExperience: '1-3',
    allowedExperienceIds: [],
    photoUrl: '',
    internalNotes: '',
  };
}

function formFromDetail(detail: AdminGuideDetail): GuideFormInput {
  return {
    guideUid: detail.uid,
    displayName: detail.displayName,
    phone: detail.phone,
    email: detail.email,
    bio: detail.bio,
    languages: [...detail.languages],
    specialties: [...detail.specialties],
    yearsExperience: detail.yearsExperience,
    allowedExperienceIds: [...detail.allowedExperienceIds],
    photoUrl: detail.photoUrl ?? '',
    internalNotes: detail.internalNotes ?? '',
    status: detail.status,
  };
}

export default function AdminGuideDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; mode?: string | string[] }>();
  const guideId = normalizeParam(params.id);
  const isCreateMode = normalizeParam(params.mode) === 'create';

  const { user } = useAuth();
  const adminUid = user?.uid ?? '';

  const [detail, setDetail] = useState<AdminGuideDetail | null>(null);
  const [form, setForm] = useState<GuideFormInput>(emptyForm());
  const [customLanguage, setCustomLanguage] = useState('');
  const [loading, setLoading] = useState(!isCreateMode);
  const [saving, setSaving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const loadGuide = useCallback(async () => {
    if (isCreateMode) {
      setDetail(null);
      setForm(emptyForm());
      setLoading(false);
      return;
    }

    if (!guideId) {
      setDetail(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      devLog('[ADMIN GUIDES] load details', { guideId });
      const loaded = await fetchGuideDetail(guideId);
      setDetail(loaded);
      if (loaded) {
        setForm(formFromDetail(loaded));
      }
    } catch (error) {
      devError('[ADMIN GUIDES] load details failed', error);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [guideId, isCreateMode]);

  useEffect(() => {
    void loadGuide();
  }, [loadGuide]);

  const bioLength = form.bio.trim().length;
  const bioInvalid = bioLength > 0 && (bioLength < BIO_MIN || bioLength > BIO_MAX);

  const updateForm = useCallback((patch: Partial<GuideFormInput>) => {
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  const toggleSpecialty = useCallback((id: GuideSpecialty) => {
    setForm((current) => {
      const selected = current.specialties.includes(id);
      if (selected) {
        return {
          ...current,
          specialties: current.specialties.filter((item) => item !== id),
        };
      }
      if (current.specialties.length >= MAX_SPECIALTIES) {
        Alert.alert('Spécialités', `Maximum ${MAX_SPECIALTIES} spécialités par guide.`);
        return current;
      }
      return { ...current, specialties: [...current.specialties, id] };
    });
  }, []);

  const toggleExperience = useCallback((id: GuideExperienceId) => {
    setForm((current) => {
      const selected = current.allowedExperienceIds.includes(id);
      if (selected) {
        return {
          ...current,
          allowedExperienceIds: current.allowedExperienceIds.filter((item) => item !== id),
        };
      }
      return {
        ...current,
        allowedExperienceIds: [...current.allowedExperienceIds, id],
      };
    });
  }, []);

  const toggleLanguage = useCallback((lang: string) => {
    const code = lang.trim().toLowerCase();
    if (!code) return;
    setForm((current) => {
      const has = current.languages.includes(code);
      if (has) {
        const next = current.languages.filter((item) => item !== code);
        return { ...current, languages: next.length ? next : current.languages };
      }
      return { ...current, languages: [...current.languages, code] };
    });
  }, []);

  const addCustomLanguage = useCallback(() => {
    const code = customLanguage.trim().toLowerCase();
    if (!code) return;
    toggleLanguage(code);
    setCustomLanguage('');
  }, [customLanguage, toggleLanguage]);

  const buildSubmitInput = useCallback((): GuideFormInput => {
    return {
      ...form,
      guideUid: isCreateMode ? form.guideUid.trim() : guideId,
      displayName: form.displayName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      bio: form.bio.trim(),
      photoUrl: form.photoUrl?.trim() || undefined,
      internalNotes: form.internalNotes?.trim() || undefined,
      languages: form.languages.map((l) => l.trim()).filter(Boolean),
    };
  }, [form, guideId, isCreateMode]);

  const handleSaveProfile = useCallback(async () => {
    const input = buildSubmitInput();
    setSaving(true);
    try {
      if (isCreateMode) {
        const created = await createGuide({
          ...input,
          status: 'pending_review',
        });
        Alert.alert('Guide créé', 'Le profil guide a été enregistré.');
        router.replace({
          pathname: '/admin-guide-details',
          params: { id: created.uid },
        });
        return;
      }

      await updateGuideProfile(input);
      await loadGuide();
      Alert.alert('Enregistré', 'Le profil guide a été mis à jour.');
    } catch (error) {
      Alert.alert('Erreur', getGuideAssignErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }, [buildSubmitInput, isCreateMode, loadGuide]);

  const runStatusAction = useCallback(
    async (label: string, action: () => Promise<unknown>) => {
      setStatusUpdating(true);
      try {
        await action();
        await loadGuide();
        Alert.alert(label, 'Statut mis à jour.');
      } catch (error) {
        Alert.alert('Erreur', getGuideAssignErrorMessage(error));
      } finally {
        setStatusUpdating(false);
      }
    },
    [loadGuide],
  );

  const confirmAction = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      Alert.alert(title, message, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: onConfirm },
      ]);
    },
    [],
  );

  const statusLabel = useMemo(() => {
    if (isCreateMode) return 'Nouveau profil';
    return detail ? getGuideStatusLabel(detail.status) : '—';
  }, [detail, isCreateMode]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={green} />
          <Text style={styles.loadingText}>Chargement du guide...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isCreateMode && !detail) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <Text style={styles.errorTitle}>Guide introuvable</Text>
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
          <Text style={styles.title}>
            {isCreateMode ? 'Nouveau guide' : form.displayName || 'Guide PROTAXI'}
          </Text>
          <Text style={styles.subtitle}>
            {isCreateMode ? 'Création du registre guides/{uid}' : statusLabel}
          </Text>
          {!isCreateMode && detail ? (
            <View
              style={[
                styles.statusPill,
                detail.status === 'active' ? styles.statusActive : styles.statusMuted,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  detail.status === 'active' ? styles.statusTextActive : styles.statusTextMuted,
                ]}
              >
                {detail.statusLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {isCreateMode ? (
          <View style={styles.infoBanner}>
            <MaterialCommunityIcons name="information-outline" size={20} color={gold} />
            <Text style={styles.infoBannerText}>
              Créez d'abord le compte Firebase Authentication du guide, puis saisissez son UID
              ci-dessous. Le document sera enregistré dans guides/{'{uid}'}.
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Identité & contact</Text>

          {isCreateMode ? (
            <Field label="UID Firebase Auth *">
              <TextInput
                style={styles.input}
                value={form.guideUid}
                onChangeText={(value) => updateForm({ guideUid: value })}
                placeholder="Coller l'uid Auth du guide"
                placeholderTextColor={muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
          ) : (
            <InfoRow label="UID Auth" value={form.guideUid} />
          )}

          <Field label="Nom affiché *">
            <TextInput
              style={styles.input}
              value={form.displayName}
              onChangeText={(value) => updateForm({ displayName: value })}
              placeholder="Nom affiché client / admin"
              placeholderTextColor={muted}
            />
          </Field>

          <Field label="Téléphone *">
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(value) => updateForm({ phone: value })}
              placeholder="0555 00 00 00"
              placeholderTextColor={muted}
              keyboardType="phone-pad"
            />
          </Field>

          <Field label="Email *">
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(value) => updateForm({ email: value })}
              placeholder="guide@email.com"
              placeholderTextColor={muted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Field>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Profil</Text>

          <Field label={`Biographie * (${bioLength}/${BIO_MAX})`}>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.bio}
              onChangeText={(value) => updateForm({ bio: value })}
              placeholder="50 à 300 caractères"
              placeholderTextColor={muted}
              multiline
              textAlignVertical="top"
            />
            {bioInvalid ? (
              <Text style={styles.fieldError}>La biographie doit contenir entre 50 et 300 caractères.</Text>
            ) : null}
          </Field>

          <Text style={styles.fieldLabel}>Années d'expérience *</Text>
          <View style={styles.chipRow}>
            {GUIDE_YEARS_EXPERIENCE_OPTIONS.map((option) => {
              const active = form.yearsExperience === option.id;
              return (
                <Pressable
                  key={option.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => updateForm({ yearsExperience: option.id as GuideYearsExperience })}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Langues *</Text>
          <View style={styles.chipRow}>
            {LANGUAGE_PRESETS.map((lang) => {
              const active = form.languages.includes(lang);
              return (
                <Pressable
                  key={lang}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleLanguage(lang)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{lang.toUpperCase()}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.customLangRow}>
            <TextInput
              style={[styles.input, styles.customLangInput]}
              value={customLanguage}
              onChangeText={setCustomLanguage}
              placeholder="Autre (ex. it)"
              placeholderTextColor={muted}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.addLangBtn} onPress={addCustomLanguage}>
              <Text style={styles.addLangBtnText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hintText}>Sélection : {form.languages.join(', ') || '—'}</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Spécialités (max. {MAX_SPECIALTIES})</Text>
          <Text style={styles.hintText}>
            Sélectionnées : {form.specialties.map(getGuideSpecialtyLabel).join(', ') || '—'} (
            {form.specialties.length}/{MAX_SPECIALTIES})
          </Text>
          <View style={styles.chipRowWrap}>
            {GUIDE_SPECIALTY_DEFS.map((item) => {
              const active = form.specialties.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleSpecialty(item.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Expériences autorisées *</Text>
          <Text style={styles.hintText}>
            {form.allowedExperienceIds.length} expérience
            {form.allowedExperienceIds.length > 1 ? 's sélectionnées' : ' sélectionnée'}
          </Text>
          {EXPERIENCE_OPTIONS.map((option) => {
            const checked = form.allowedExperienceIds.includes(option.id);
            return (
              <Pressable
                key={option.id}
                style={styles.experienceRow}
                onPress={() => toggleExperience(option.id)}
              >
                <Ionicons
                  name={checked ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={checked ? green : muted}
                />
                <Text style={styles.experienceLabel}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Options admin</Text>
          <Field label="URL photo (optionnel)">
            <TextInput
              style={styles.input}
              value={form.photoUrl ?? ''}
              onChangeText={(value) => updateForm({ photoUrl: value })}
              placeholder="https://..."
              placeholderTextColor={muted}
              autoCapitalize="none"
            />
          </Field>
          <Field label="Notes internes">
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.internalNotes ?? ''}
              onChangeText={(value) => updateForm({ internalNotes: value })}
              placeholder="Notes visibles admin uniquement"
              placeholderTextColor={muted}
              multiline
              textAlignVertical="top"
            />
          </Field>
        </View>

        {!isCreateMode && detail?.validatedAt ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Validation</Text>
            <InfoRow label="Validé le" value={formatTimestampLabel(detail.validatedAt)} />
            <InfoRow label="Validé par" value={detail.validatedBy || '—'} />
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, (saving || statusUpdating) && styles.btnDisabled]}
          disabled={saving || statusUpdating}
          onPress={() => void handleSaveProfile()}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#050505" />
          ) : (
            <Ionicons name="save-outline" size={18} color="#050505" />
          )}
          <Text style={styles.primaryBtnText}>
            {isCreateMode ? 'Créer le profil guide' : 'Enregistrer les modifications'}
          </Text>
        </TouchableOpacity>

        {!isCreateMode && detail ? (
          <View style={styles.statusActions}>
            <Text style={styles.sectionTitle}>Actions statut</Text>

            {detail.status === 'draft' ? (
              <TouchableOpacity
                style={[styles.outlineBtn, statusUpdating && styles.btnDisabled]}
                disabled={statusUpdating || saving}
                onPress={() =>
                  confirmAction(
                    'Soumettre pour validation',
                    `Envoyer le profil de ${detail.displayName} en validation ?`,
                    () => void runStatusAction('Soumis', () => submitGuideForReview(detail.uid)),
                  )
                }
              >
                <Text style={styles.outlineBtnText}>Soumettre pour validation</Text>
              </TouchableOpacity>
            ) : null}

            {detail.status === 'pending_review' ? (
              <>
                <TouchableOpacity
                  style={[styles.primaryBtn, statusUpdating && styles.btnDisabled]}
                  disabled={statusUpdating || saving || !adminUid}
                  onPress={() =>
                    confirmAction(
                      'Valider le guide',
                      `Certifier ${detail.displayName} comme guide PROTAXI actif ?`,
                      () => void runStatusAction('Guide validé', () => validateGuide(detail.uid, adminUid)),
                    )
                  }
                >
                  <Text style={styles.primaryBtnText}>Valider le guide</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dangerBtn, statusUpdating && styles.btnDisabled]}
                  disabled={statusUpdating || saving}
                  onPress={() =>
                    confirmAction(
                      'Suspendre',
                      `Suspendre ${detail.displayName} avant validation ?`,
                      () => void runStatusAction('Suspendu', () => suspendGuide(detail.uid)),
                    )
                  }
                >
                  <Text style={styles.dangerBtnText}>Suspendre</Text>
                </TouchableOpacity>
              </>
            ) : null}

            {detail.status === 'active' ? (
              <TouchableOpacity
                style={[styles.dangerBtn, statusUpdating && styles.btnDisabled]}
                disabled={statusUpdating || saving}
                onPress={() =>
                  confirmAction(
                    'Suspendre le guide',
                    `Confirmer la suspension de ${detail.displayName} ?`,
                    () => void runStatusAction('Suspendu', () => suspendGuide(detail.uid)),
                  )
                }
              >
                <Ionicons name="pause-circle-outline" size={18} color="#FFF" />
                <Text style={styles.dangerBtnText}>Suspendre</Text>
              </TouchableOpacity>
            ) : null}

            {detail.status === 'suspended' ? (
              <TouchableOpacity
                style={[styles.primaryBtn, statusUpdating && styles.btnDisabled]}
                disabled={statusUpdating || saving || !adminUid}
                onPress={() =>
                  confirmAction(
                    'Réactiver le guide',
                    `Réactiver ${detail.displayName} comme guide certifié ?`,
                    () =>
                      void runStatusAction('Réactivé', () => reactivateGuide(detail.uid, adminUid)),
                  )
                }
              >
                <Text style={styles.primaryBtnText}>Réactiver</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
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
  header: { marginBottom: 16 },
  title: { color: '#FFF', fontSize: 26, fontWeight: '900' },
  subtitle: { color: green, fontSize: 14, fontWeight: '700', marginTop: 6 },
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
  statusMuted: {
    backgroundColor: 'rgba(138,138,138,0.12)',
    borderWidth: 1,
    borderColor: border,
  },
  statusText: { fontSize: 12, fontWeight: '800' },
  statusTextActive: { color: green },
  statusTextMuted: { color: muted },
  infoBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(212,160,23,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.3)',
    padding: 14,
    marginBottom: 14,
  },
  infoBannerText: { flex: 1, color: '#E8D5A8', fontSize: 12, lineHeight: 18 },
  sectionCard: {
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    marginBottom: 14,
    gap: 10,
  },
  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  fieldBlock: { gap: 6 },
  fieldLabel: { color: muted, fontSize: 11, fontWeight: '700' },
  fieldError: { color: red, fontSize: 11, fontWeight: '600' },
  input: {
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 14,
  },
  textArea: { minHeight: 100, paddingTop: 12 },
  hintText: { color: muted, fontSize: 11, lineHeight: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: '#111',
  },
  chipActive: {
    backgroundColor: 'rgba(139,197,63,0.14)',
    borderColor: 'rgba(139,197,63,0.4)',
  },
  chipText: { color: muted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: green },
  customLangRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  customLangInput: { flex: 1 },
  addLangBtn: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addLangBtnText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  experienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  experienceLabel: { color: '#FFF', fontSize: 14, fontWeight: '600', flex: 1 },
  infoRow: { gap: 4 },
  infoLabel: { color: muted, fontSize: 11, fontWeight: '700' },
  infoValue: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: green,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  primaryBtnText: { color: '#050505', fontSize: 14, fontWeight: '800' },
  outlineBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: border,
    backgroundColor: '#111',
    marginBottom: 10,
  },
  outlineBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,90,90,0.15)',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,90,90,0.35)',
    marginBottom: 10,
  },
  dangerBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
  statusActions: { marginTop: 4, marginBottom: 24 },
  secondaryBtn: {
    marginTop: 8,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  secondaryBtnText: { color: '#FFF', fontWeight: '700' },
});
