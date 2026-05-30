import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PROTAXI_ROUTES } from '@/utils/navigation';

const bg = '#050505';
const gold = '#D4A017';
const muted = '#8A8A8A';

/** Profil hôtel partenaire — placeholder navigation Lot 5 (édition métier lot 8). */
export default function PartnerProfileScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Ionicons name="business-outline" size={40} color={gold} />
        <Text style={styles.title}>Mon profil hôtel</Text>
        <Text style={styles.subtitle}>
          Écran profil partenaire — navigation Lot 5. L&apos;édition métier sera livrée au lot 8.
        </Text>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.85}
          onPress={() => router.replace(PROTAXI_ROUTES.partnerDashboard)}
        >
          <Ionicons name="arrow-back" size={18} color="#111" />
          <Text style={styles.backBtnText}>Retour tableau de bord</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: bg },
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  subtitle: { color: muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: gold,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  backBtnText: { color: '#111', fontSize: 14, fontWeight: '900' },
});
