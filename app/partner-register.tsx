import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import HotelPartnerProfileForm from '@/components/partner/HotelPartnerProfileForm';
import { useAuth } from '@/hooks/useAuth';
import { getPartnerSelfErrorMessage } from '@/services/partnerSelfService';
import { PartnerServiceError } from '@/types/partner';
import type { PartnerFormInput } from '@/types/partner';
import {
  createEmptyHotelPartnerProfileFormValues,
  type HotelPartnerProfileFormValues,
} from '@/types/partnerProfileForm';
import {
  hotelPartnerFormValuesToPartnerInput,
  isHotelPartnerProfileFormValid,
  validateHotelPartnerProfileFormValues,
} from '@/utils/partnerProfileFormValidation';
import { PROTAXI_ROUTES } from '@/utils/navigation';

const green = '#8BC53F';
const gold = '#D4A017';
const bg = '#050505';
const card = '#101010';
const border = '#262626';
const muted = '#8A8A8A';
const red = '#FF5A5A';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOTAL_STEPS = 3;

type AccountFieldErrors = {
  companyName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

function validateAccountStep(values: {
  companyName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): AccountFieldErrors {
  const errors: AccountFieldErrors = {};

  if (values.companyName.trim().length < 2) {
    errors.companyName = 'Entrez le nom de l\'établissement (2 caractères minimum).';
  }

  if (!EMAIL_REGEX.test(values.email.trim().toLowerCase())) {
    errors.email = 'Adresse email invalide.';
  }

  if (values.password.length < 6) {
    errors.password = 'Minimum 6 caractères.';
  }

  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Les mots de passe ne correspondent pas.';
  }

  return errors;
}

export default function PartnerRegisterScreen() {
  const { registerHotelPartner, authError, clearAuthError } = useAuth();

  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileForm, setProfileForm] = useState(createEmptyHotelPartnerProfileFormValues);
  const [accountErrors, setAccountErrors] = useState<AccountFieldErrors>({});
  const [profileErrors, setProfileErrors] = useState<
    ReturnType<typeof validateHotelPartnerProfileFormValues>
  >([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const errorMessage = localError || authError;

  const buildPartnerInput = useCallback((): PartnerFormInput => {
    const normalizedEmail = email.trim().toLowerCase();
    return hotelPartnerFormValuesToPartnerInput('', {
      ...profileForm,
      companyName: companyName.trim() || profileForm.companyName.trim(),
      email: normalizedEmail,
    }, normalizedEmail);
  }, [companyName, email, profileForm]);

  const summaryRows = useMemo(
    () => [
      { label: 'Établissement', value: companyName.trim() || profileForm.companyName.trim() || '—' },
      { label: 'Email', value: email.trim().toLowerCase() || '—' },
      { label: 'Contact', value: profileForm.contactName.trim() || '—' },
      { label: 'Téléphone', value: profileForm.phone.trim() || '—' },
      { label: 'Ville', value: profileForm.city.trim() || '—' },
      {
        label: 'Description',
        value: profileForm.description.trim()
          ? `${profileForm.description.trim().slice(0, 48)}…`
          : '—',
      },
    ],
    [companyName, email, profileForm],
  );

  const goNext = () => {
    setLocalError(null);
    clearAuthError();

    if (step === 1) {
      const errors = validateAccountStep({
        companyName,
        email,
        password,
        confirmPassword,
      });
      setAccountErrors(errors);
      if (Object.keys(errors).length > 0) {
        setLocalError('Veuillez corriger les champs du compte.');
        return;
      }
      setProfileForm((current) => ({
        ...current,
        companyName: companyName.trim(),
        email: email.trim().toLowerCase(),
      }));
      setStep(2);
      return;
    }

    if (step === 2) {
      const merged: HotelPartnerProfileFormValues = {
        ...profileForm,
        companyName: companyName.trim() || profileForm.companyName.trim(),
        email: email.trim().toLowerCase(),
      };
      setProfileForm(merged);
      const errors = validateHotelPartnerProfileFormValues(merged);
      setProfileErrors(errors);
      if (!isHotelPartnerProfileFormValid(merged)) {
        setLocalError('Complétez le profil de votre établissement.');
        return;
      }
      setStep(3);
    }
  };

  const goBack = () => {
    setLocalError(null);
    clearAuthError();
    if (step > 1) {
      setStep((current) => current - 1);
      return;
    }
    router.back();
  };

  const handleSubmit = async () => {
    setLocalError(null);
    clearAuthError();

    const accountStepErrors = validateAccountStep({
      companyName,
      email,
      password,
      confirmPassword,
    });
    const merged: HotelPartnerProfileFormValues = {
      ...profileForm,
      companyName: companyName.trim() || profileForm.companyName.trim(),
      email: email.trim().toLowerCase(),
    };
    const profileStepErrors = validateHotelPartnerProfileFormValues(merged);
    setAccountErrors(accountStepErrors);
    setProfileErrors(profileStepErrors);

    if (Object.keys(accountStepErrors).length > 0 || profileStepErrors.length > 0) {
      setLocalError('Vérifiez les informations avant envoi.');
      if (Object.keys(accountStepErrors).length > 0) setStep(1);
      else if (profileStepErrors.length > 0) setStep(2);
      return;
    }

    setSubmitting(true);

    try {
      const role = await registerHotelPartner(
        email.trim().toLowerCase(),
        password,
        buildPartnerInput(),
      );

      if (role !== 'partner') {
        throw new Error('Inscription partenaire incomplète. Réessayez.');
      }

      router.replace({
        pathname: PROTAXI_ROUTES.partnerDashboard,
        params: { registered: '1' },
      });
    } catch (error) {
      if (error instanceof PartnerServiceError) {
        setLocalError(getPartnerSelfErrorMessage(error));
      } else {
        setLocalError((error as Error).message || 'Inscription impossible.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const updateProfile = (patch: Partial<HotelPartnerProfileFormValues>) => {
    setProfileForm((current) => ({ ...current, ...patch }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={['rgba(212,160,23,0.12)', 'rgba(5,5,5,0)']}
            style={styles.heroGlow}
          />

          <TouchableOpacity style={styles.backBtn} onPress={goBack}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.brandBlock}>
            <View style={styles.logoCircle}>
              <MaterialCommunityIcons name="domain" size={34} color={gold} />
            </View>
            <Text style={styles.brandTitle}>Partenaire hôtel PROTAXI</Text>
            <Text style={styles.brandSubtitle}>
              Inscrivez votre établissement — validation par l&apos;équipe PROTAXI avant activation
            </Text>
          </View>

          <View style={styles.stepRow}>
            {Array.from({ length: TOTAL_STEPS }, (_, index) => {
              const stepNumber = index + 1;
              const active = step === stepNumber;
              const done = step > stepNumber;
              return (
                <View key={stepNumber} style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepDot,
                      active && styles.stepDotActive,
                      done && styles.stepDotDone,
                    ]}
                  >
                    <Text
                      style={[
                        styles.stepDotText,
                        (active || done) && styles.stepDotTextActive,
                      ]}
                    >
                      {stepNumber}
                    </Text>
                  </View>
                  <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>
                    {stepNumber === 1 ? 'Compte' : stepNumber === 2 ? 'Profil' : 'Envoi'}
                  </Text>
                </View>
              );
            })}
          </View>

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={red} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Étape 1 — Votre compte</Text>

              <Field label="Nom de l'établissement *" error={accountErrors.companyName}>
                <TextInput
                  style={styles.input}
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Ex. Hôtel El Mountazah"
                  placeholderTextColor={muted}
                />
              </Field>

              <Field label="Email *" error={accountErrors.email}>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="contact@hotel.com"
                  placeholderTextColor={muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </Field>

              <Field label="Mot de passe *" error={accountErrors.password}>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Minimum 6 caractères"
                  placeholderTextColor={muted}
                  secureTextEntry
                />
              </Field>

              <Field label="Confirmer le mot de passe *" error={accountErrors.confirmPassword}>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Répétez le mot de passe"
                  placeholderTextColor={muted}
                  secureTextEntry
                />
              </Field>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Étape 2 — Profil hôtel</Text>
              <Text style={styles.cardHint}>
                Coordonnées et présentation de votre établissement pour la validation PROTAXI.
              </Text>
              <HotelPartnerProfileForm
                value={{
                  ...profileForm,
                  companyName: companyName.trim() || profileForm.companyName,
                  email: email.trim().toLowerCase(),
                }}
                onChange={updateProfile}
                fieldErrors={profileErrors}
              />
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Étape 3 — Envoi du dossier</Text>
              <Text style={styles.cardHint}>
                Votre compte Firebase et le document partners/{'{uid}'} seront créés avec le
                statut en attente de validation (isActive: false).
              </Text>

              {summaryRows.map((row) => (
                <View key={row.label} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{row.label}</Text>
                  <Text style={styles.summaryValue}>{row.value}</Text>
                </View>
              ))}

              <View style={styles.pendingInfo}>
                <MaterialCommunityIcons name="clock-outline" size={20} color={gold} />
                <Text style={styles.pendingInfoText}>
                  Après envoi, votre établissement sera en attente de validation PROTAXI. Les
                  réservations partenaire seront disponibles une fois le compte actif.
                </Text>
              </View>
            </View>
          ) : null}

          {step < 3 ? (
            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.9} onPress={goNext}>
              <Text style={styles.primaryBtnText}>Continuer</Text>
              <Ionicons name="arrow-forward" size={18} color="#111" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
              activeOpacity={0.9}
              onPress={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#111" />
              ) : (
                <Ionicons name="paper-plane-outline" size={18} color="#111" />
              )}
              <Text style={styles.primaryBtnText}>
                {submitting ? 'Création en cours…' : 'Créer mon compte hôtel'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.85}
            onPress={() => router.push(PROTAXI_ROUTES.login)}
          >
            <Text style={styles.secondaryBtnText}>Déjà un compte ? Se connecter</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: bg },
  scrollContent: { padding: 20, paddingBottom: 40 },
  heroGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
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
    marginBottom: 12,
  },
  brandBlock: { alignItems: 'center', marginBottom: 20 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(212,160,23,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandTitle: { color: '#FFF', fontSize: 24, fontWeight: '900' },
  brandSubtitle: {
    color: muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
    paddingHorizontal: 12,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  stepItem: { flex: 1, alignItems: 'center', gap: 6 },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    borderColor: gold,
    backgroundColor: 'rgba(212,160,23,0.2)',
  },
  stepDotDone: {
    borderColor: gold,
    backgroundColor: gold,
  },
  stepDotText: { color: muted, fontSize: 13, fontWeight: '800' },
  stepDotTextActive: { color: '#111' },
  stepLabel: { color: muted, fontSize: 10, fontWeight: '700' },
  stepLabelActive: { color: gold },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,90,90,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,90,0.35)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: '#FFB4B4', fontSize: 13, flex: 1, lineHeight: 18 },
  card: {
    backgroundColor: card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: border,
    padding: 18,
    marginBottom: 16,
    gap: 12,
  },
  cardTitle: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  cardHint: { color: muted, fontSize: 12, lineHeight: 17 },
  fieldBlock: { gap: 6 },
  fieldLabel: { color: muted, fontSize: 11, fontWeight: '700' },
  fieldError: { color: red, fontSize: 11, fontWeight: '600' },
  input: {
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: border,
    paddingVertical: 10,
    gap: 12,
  },
  summaryLabel: { color: muted, fontSize: 12, fontWeight: '700' },
  summaryValue: { color: '#FFF', fontSize: 13, fontWeight: '700', flex: 1, textAlign: 'right' },
  pendingInfo: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(212,160,23,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.3)',
    padding: 12,
    marginTop: 4,
  },
  pendingInfoText: { flex: 1, color: '#E8D5A8', fontSize: 12, lineHeight: 17 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: green,
    borderRadius: 16,
    paddingVertical: 15,
    marginBottom: 10,
  },
  primaryBtnDisabled: { opacity: 0.65 },
  primaryBtnText: { color: '#111', fontSize: 16, fontWeight: '900' },
  secondaryBtn: { alignItems: 'center', paddingVertical: 12 },
  secondaryBtnText: { color: gold, fontSize: 14, fontWeight: '700' },
});
