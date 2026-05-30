import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

import GuideScreenShell from '@/components/guide/GuideScreenShell';

const green = '#8BC53F';
const gold = '#D4A017';

export default function GuideDashboardScreen() {
  const { registered } = useLocalSearchParams<{ registered?: string | string[] }>();
  const showRegisteredBanner =
    registered === '1' || (Array.isArray(registered) && registered[0] === '1');

  return (
    <View style={styles.wrap}>
      {showRegisteredBanner ? (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={22} color={green} />
          <View style={{ flex: 1 }}>
            <Text style={styles.successTitle}>Profil en attente de validation</Text>
            <Text style={styles.successText}>
              Votre dossier guide a bien été enregistré. L&apos;équipe PROTAXI le valide avant
              toute mission sur une expérience.
            </Text>
          </View>
          <MaterialCommunityIcons name="clock-outline" size={20} color={gold} />
        </View>
      ) : null}

      <GuideScreenShell
        title="Espace guide PROTAXI"
        subtitle={
          showRegisteredBanner
            ? 'Bienvenue — suivez l’avancement de votre validation ici.'
            : 'Tableau de bord — contenu métier enrichi au lot 7.'
        }
        showProfileLink
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: -8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(139,197,63,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
  },
  successTitle: { color: '#FFF', fontSize: 14, fontWeight: '900', marginBottom: 4 },
  successText: { color: '#B8D4A0', fontSize: 12, lineHeight: 17 },
});
