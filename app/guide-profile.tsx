import { router } from 'expo-router';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { PROTAXI_ROUTES } from '@/utils/navigation';

const bg = '#050505';
const green = '#8BC53F';

/** Coquille navigation Lot 4 — édition profil au lot 7. */
export default function GuideProfileScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Ionicons name="person-outline" size={40} color={green} />
        <Text style={styles.title}>Mon profil guide</Text>
        <Text style={styles.subtitle}>
          Écran profil — navigation Lot 4. L&apos;édition métier sera livrée au lot 7.
        </Text>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.85}
          onPress={() => router.replace(PROTAXI_ROUTES.guideDashboard)}
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
  subtitle: { color: '#8A8A8A', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: green,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  backBtnText: { color: '#111', fontSize: 14, fontWeight: '900' },
});
