import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { useAuth } from '@/hooks/useAuth';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';

const gold = '#FFD700';
const bg = '#050505';
const card = '#101010';
const border = '#262626';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
};

const validateForm = (values: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}): FieldErrors => {
  const errors: FieldErrors = {};

  if (values.fullName.trim().length < 2) {
    errors.fullName = 'Entrez votre nom complet.';
  }

  if (!EMAIL_REGEX.test(values.email.trim().toLowerCase())) {
    errors.email = 'Adresse email invalide.';
  }

  const phoneDigits = values.phone.replace(/\D/g, '');
  if (phoneDigits.length < 8) {
    errors.phone = 'Numéro de téléphone invalide.';
  }

  if (values.password.length < 6) {
    errors.password = 'Minimum 6 caractères.';
  }

  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Les mots de passe ne correspondent pas.';
  }

  return errors;
};

export default function RegisterScreen() {
  const { registerClient, authError, clearAuthError } = useAuth();
  const { redirectByRole } = useAuthRedirect();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const errorMessage = localError || authError;

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    return (
      fullName.trim().length >= 2 &&
      EMAIL_REGEX.test(email.trim()) &&
      phone.replace(/\D/g, '').length >= 8 &&
      password.length >= 6 &&
      confirmPassword === password
    );
  }, [submitting, fullName, email, phone, password, confirmPassword]);

  const handleSubmit = async () => {
    const errors = validateForm({
      fullName,
      email,
      phone,
      password,
      confirmPassword,
    });

    setFieldErrors(errors);
    setLocalError(null);
    clearAuthError();

    if (Object.keys(errors).length > 0) {
      setLocalError('Veuillez corriger les champs indiqués.');
      return;
    }

    setSubmitting(true);

    try {
      const role = await registerClient(
        fullName.trim(),
        email.trim().toLowerCase(),
        password,
        phone.trim()
      );

      redirectByRole(role);
    } catch (error) {
      setLocalError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
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
            colors={['rgba(255,215,0,0.12)', 'rgba(5,5,5,0)']}
            style={styles.heroGlow}
          />

          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.brandBlock}>
            <View style={styles.logoCircle}>
              <MaterialCommunityIcons name="account-plus-outline" size={34} color={gold} />
            </View>
            <Text style={styles.brandTitle}>PROTAXI24</Text>
            <Text style={styles.brandSubtitle}>
              Créez votre compte client en quelques secondes
            </Text>
          </View>

          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.cardTitle}>Créer un compte</Text>
            <Text style={styles.cardSubtitle}>
              Réservez vos courses PROTAXI avec un profil sécurisé.
            </Text>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Nom complet</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Ex. Amine Boudiaf"
                placeholderTextColor="#666"
                autoCapitalize="words"
                style={[styles.input, fieldErrors.fullName ? styles.inputError : null]}
              />
              {fieldErrors.fullName ? (
                <Text style={styles.fieldError}>{fieldErrors.fullName}</Text>
              ) : null}
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="client@protaxi.dz"
                placeholderTextColor="#666"
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, fieldErrors.email ? styles.inputError : null]}
              />
              {fieldErrors.email ? (
                <Text style={styles.fieldError}>{fieldErrors.email}</Text>
              ) : null}
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Téléphone</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+213 671 42 14 48"
                placeholderTextColor="#666"
                keyboardType="phone-pad"
                style={[styles.input, fieldErrors.phone ? styles.inputError : null]}
              />
              {fieldErrors.phone ? (
                <Text style={styles.fieldError}>{fieldErrors.phone}</Text>
              ) : null}
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Mot de passe</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Minimum 6 caractères"
                placeholderTextColor="#666"
                secureTextEntry
                style={[styles.input, fieldErrors.password ? styles.inputError : null]}
              />
              {fieldErrors.password ? (
                <Text style={styles.fieldError}>{fieldErrors.password}</Text>
              ) : null}
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Confirmer le mot de passe</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Retapez votre mot de passe"
                placeholderTextColor="#666"
                secureTextEntry
                style={[
                  styles.input,
                  fieldErrors.confirmPassword ? styles.inputError : null,
                ]}
              />
              {fieldErrors.confirmPassword ? (
                <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text>
              ) : null}
            </View>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? (
                <>
                  <ActivityIndicator color="#111" />
                  <Text style={styles.submitText}>Création en cours...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={22} color="#111" />
                  <Text style={styles.submitText}>Créer mon compte</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loginLinkBtn}
              onPress={() => router.replace('/login')}
            >
              <Text style={styles.loginLinkText}>
                Déjà un compte ? <Text style={styles.loginLinkAccent}>Se connecter</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: bg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 40,
  },
  heroGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
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
    marginBottom: 18,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: card,
    borderWidth: 1.5,
    borderColor: 'rgba(255,215,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 16,
    letterSpacing: 1,
  },
  brandSubtitle: {
    color: '#AAA',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: border,
    padding: 22,
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
  },
  cardSubtitle: {
    color: '#AAA',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 18,
    fontWeight: '600',
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: '#AAA',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    paddingHorizontal: 16,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  inputError: {
    borderColor: 'rgba(239,68,68,0.55)',
  },
  fieldError: {
    color: '#FCA5A5',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  submitBtn: {
    height: 56,
    borderRadius: 18,
    backgroundColor: gold,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  submitBtnDisabled: {
    opacity: 0.55,
  },
  submitText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
  },
  loginLinkBtn: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 8,
  },
  loginLinkText: {
    color: '#AAA',
    fontSize: 14,
    fontWeight: '600',
  },
  loginLinkAccent: {
    color: gold,
    fontWeight: '900',
  },
});
