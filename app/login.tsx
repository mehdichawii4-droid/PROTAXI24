import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD } from '@/firebase';
import { PROTAXI_ROUTES } from '@/utils/navigation';

const gold = '#FFD700';
const green = '#8BC53F';
const bg = '#050505';
const card = '#101010';
const border = '#262626';

type LoginMode = 'email' | 'phone';

export default function LoginScreen() {
  const { login, loginWithPhoneNumber, authError, clearAuthError } = useAuth();
  const { redirectByRole } = useAuthRedirect();
  const [mode, setMode] = useState<LoginMode>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const errorMessage = localError || authError;

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (!password.trim()) return false;
    return mode === 'email' ? Boolean(email.trim()) : Boolean(phone.trim());
  }, [submitting, password, mode, email, phone]);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setLocalError(null);
    clearAuthError();

    try {
      const role =
        mode === 'email'
          ? await login(email.trim().toLowerCase(), password)
          : await loginWithPhoneNumber(phone.trim(), password);

      redirectByRole(role);
    } catch (error) {
      setLocalError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const fillBootstrapAdmin = () => {
    setMode('email');
    setEmail(BOOTSTRAP_ADMIN_EMAIL);
    setPassword(BOOTSTRAP_ADMIN_PASSWORD);
    setLocalError(null);
    clearAuthError();
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

          <View style={styles.brandBlock}>
            <View style={styles.logoCircle}>
              <MaterialCommunityIcons name="taxi" size={34} color={gold} />
            </View>
            <Text style={styles.brandTitle}>PROTAXI24</Text>
            <Text style={styles.brandSubtitle}>
              Connexion sécurisée • Client • Chauffeur • Admin
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Se connecter</Text>
            <Text style={styles.cardSubtitle}>
              Accédez à votre espace selon votre rôle.
            </Text>

            <View style={styles.modeSwitch}>
              <Pressable
                style={[styles.modeBtn, mode === 'email' && styles.modeBtnActive]}
                onPress={() => {
                  setMode('email');
                  setLocalError(null);
                  clearAuthError();
                }}
              >
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={mode === 'email' ? '#111' : '#FFF'}
                />
                <Text
                  style={[
                    styles.modeBtnText,
                    mode === 'email' && styles.modeBtnTextActive,
                  ]}
                >
                  Email
                </Text>
              </Pressable>

              <Pressable
                style={[styles.modeBtn, mode === 'phone' && styles.modeBtnActive]}
                onPress={() => {
                  setMode('phone');
                  setLocalError(null);
                  clearAuthError();
                }}
              >
                <Ionicons
                  name="call-outline"
                  size={18}
                  color={mode === 'phone' ? '#111' : '#FFF'}
                />
                <Text
                  style={[
                    styles.modeBtnText,
                    mode === 'phone' && styles.modeBtnTextActive,
                  ]}
                >
                  Téléphone
                </Text>
              </Pressable>
            </View>

            {mode === 'email' ? (
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="client@protaxi.dz"
                  placeholderTextColor="#666"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </View>
            ) : (
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Téléphone</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+213 671 42 14 48"
                  placeholderTextColor="#666"
                  keyboardType="phone-pad"
                  style={styles.input}
                />
              </View>
            )}

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Mot de passe</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#666"
                secureTextEntry
                style={styles.input}
              />
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
                <ActivityIndicator color="#111" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={22} color="#111" />
                  <Text style={styles.submitText}>Connexion</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.registerLinkBtn}
              onPress={() => router.push('/register')}
            >
              <Ionicons name="person-add-outline" size={18} color={gold} />
              <Text style={styles.registerLinkText}>Créer un compte</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.guideLinkBtn}
              onPress={() => router.push(PROTAXI_ROUTES.guideRegister)}
            >
              <MaterialCommunityIcons name="account-tie-outline" size={18} color={green} />
              <Text style={styles.guideLinkText}>Devenir guide PROTAXI</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.partnerLinkBtn}
              onPress={() => router.push(PROTAXI_ROUTES.partnerRegister)}
            >
              <MaterialCommunityIcons name="domain" size={18} color={gold} />
              <Text style={styles.partnerLinkText}>Inscrire mon hôtel partenaire</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bootstrapCard}>
            <Text style={styles.bootstrapTitle}>Admin bootstrap temporaire</Text>
            <Text style={styles.bootstrapText}>
              {BOOTSTRAP_ADMIN_EMAIL}
            </Text>
            <TouchableOpacity style={styles.bootstrapBtn} onPress={fillBootstrapAdmin}>
              <Text style={styles.bootstrapBtnText}>Préremplir admin test</Text>
            </TouchableOpacity>
          </View>
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
    paddingTop: 28,
    paddingBottom: 40,
  },
  heroGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 28,
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
  modeSwitch: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  modeBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: '#151515',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  modeBtnActive: {
    backgroundColor: gold,
    borderColor: gold,
  },
  modeBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  modeBtnTextActive: {
    color: '#111',
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
  registerLinkBtn: {
    marginTop: 16,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.28)',
    backgroundColor: 'rgba(255,215,0,0.08)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  registerLinkText: {
    color: gold,
    fontSize: 14,
    fontWeight: '900',
  },
  guideLinkBtn: {
    marginTop: 10,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
    backgroundColor: 'rgba(139,197,63,0.08)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  guideLinkText: {
    color: green,
    fontSize: 14,
    fontWeight: '900',
  },
  partnerLinkBtn: {
    marginTop: 10,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
    backgroundColor: 'rgba(212,160,23,0.08)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  partnerLinkText: {
    color: gold,
    fontSize: 14,
    fontWeight: '900',
  },
  bootstrapCard: {
    marginTop: 18,
    backgroundColor: '#111',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    padding: 16,
  },
  bootstrapTitle: {
    color: gold,
    fontSize: 13,
    fontWeight: '900',
  },
  bootstrapText: {
    color: '#DDD',
    fontSize: 13,
    marginTop: 8,
    fontWeight: '700',
  },
  bootstrapBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
  },
  bootstrapBtnText: {
    color: gold,
    fontSize: 12,
    fontWeight: '800',
  },
});
