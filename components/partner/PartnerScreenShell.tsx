import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { PROTAXI_ROUTES } from '@/utils/navigation';

const bg = '#050505';
const green = '#8BC53F';
const gold = '#D4A017';
const muted = '#8A8A8A';

type PartnerScreenShellProps = {
  title: string;
  subtitle: string;
  showDashboardLink?: boolean;
  showProfileLink?: boolean;
  showRegisterHint?: boolean;
};

/** Coquille navigation Lot 5 — contenu métier livré lots 6–8. */
export default function PartnerScreenShell({
  title,
  subtitle,
  showDashboardLink = false,
  showProfileLink = false,
  showRegisterHint = false,
}: PartnerScreenShellProps) {
  const { role, profile, logout } = useAuth();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <MaterialCommunityIcons name="domain" size={48} color={gold} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {role === 'partner' && profile ? (
          <View style={styles.sessionCard}>
            <Text style={styles.sessionLabel}>Session</Text>
            <Text style={styles.sessionName}>{profile.fullName}</Text>
            <Text style={styles.sessionMeta}>
              Statut : {profile.partnerStatus ?? (profile.isApproved ? 'active' : '—')}
            </Text>
          </View>
        ) : null}

        {showRegisterHint ? (
          <Text style={styles.hint}>
            Le formulaire d&apos;inscription hôtel sera disponible au lot 6.
          </Text>
        ) : null}

        <View style={styles.actions}>
          {showDashboardLink ? (
            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              onPress={() => router.push(PROTAXI_ROUTES.partnerDashboard)}
            >
              <Ionicons name="grid-outline" size={18} color="#111" />
              <Text style={styles.primaryBtnText}>Tableau de bord partenaire</Text>
            </TouchableOpacity>
          ) : null}

          {showProfileLink ? (
            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              onPress={() => router.push(PROTAXI_ROUTES.partnerProfile)}
            >
              <Ionicons name="business-outline" size={18} color="#111" />
              <Text style={styles.primaryBtnText}>Mon profil hôtel</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/login')}
          >
            <Ionicons name="log-in-outline" size={18} color={gold} />
            <Text style={styles.secondaryBtnText}>Connexion</Text>
          </TouchableOpacity>

          {role === 'partner' ? (
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.85}
              onPress={() => void logout()}
            >
              <Ionicons name="log-out-outline" size={18} color={gold} />
              <Text style={styles.secondaryBtnText}>Déconnexion</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: bg },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: 'center',
    gap: 12,
  },
  title: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  sessionCard: {
    width: '100%',
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(212,160,23,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.3)',
    gap: 4,
  },
  sessionLabel: {
    color: muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sessionName: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  sessionMeta: { color: '#D4D4D4', fontSize: 13, fontWeight: '600' },
  hint: {
    color: muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  actions: { width: '100%', marginTop: 16, gap: 10 },
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
  secondaryBtn: {
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
  secondaryBtnText: { color: gold, fontSize: 14, fontWeight: '700' },
});
