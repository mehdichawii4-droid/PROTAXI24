import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { DISCOVER_CARD, DISCOVER_GREEN } from '@/components/discover/discoverTheme';
import DiscoverSectionHeader from '@/components/discover/DiscoverSectionHeader';

const WHY_ITEMS = [
  { icon: 'shield-checkmark-outline' as const, label: 'Guides vérifiés' },
  { icon: 'car-sport-outline' as const, label: 'Transport inclus' },
  { icon: 'map-outline' as const, label: 'Expérience locale' },
  { icon: 'lock-closed-outline' as const, label: 'Sécurité' },
];

export default function DiscoverWhyProtaxi() {
  return (
    <>
      <DiscoverSectionHeader title="Pourquoi Explorer PROTAXI ?" style={styles.header} />
      <View style={styles.grid}>
        {WHY_ITEMS.map((item) => (
          <View key={item.label} style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon} size={20} color={DISCOVER_GREEN} />
            </View>
            <Text style={styles.label}>{item.label}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  card: {
    width: '48%',
    backgroundColor: DISCOVER_CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(139,197,63,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#ECECEC',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
