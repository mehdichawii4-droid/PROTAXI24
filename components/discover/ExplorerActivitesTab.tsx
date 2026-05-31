import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { DISCOVER_CARD, DISCOVER_GREEN, DISCOVER_MUTED } from '@/components/discover/discoverTheme';

const ACTIVITY_THEMES = [
  { icon: 'leaf-outline' as const, label: 'Nature & sources', hint: 'Hammam Debagh, Maouna' },
  { icon: 'business-outline' as const, label: 'Patrimoine', hint: 'Théâtre, sites archéologiques' },
  { icon: 'water-outline' as const, label: 'Bien-être thermal', hint: 'Circuit thermal officiel' },
  { icon: 'camera-outline' as const, label: 'Spots & souvenirs', hint: 'Panoramas, photographe' },
];

export default function ExplorerActivitesTab() {
  return (
    <View style={styles.wrap}>
      <View style={styles.soonBanner}>
        <View style={styles.soonBadge}>
          <Text style={styles.soonBadgeText}>Bientôt</Text>
        </View>
        <Text style={styles.soonTitle}>Couche éditoriale Activités</Text>
        <Text style={styles.soonBody}>
          Idées, thèmes et inspirations pour sortir à Guelma — sans réserver depuis cet
          onglet pour l&apos;instant.
        </Text>
      </View>

      <Text style={styles.hint}>
        Pour réserver une sortie officielle, utilisez l&apos;onglet{' '}
        <Text style={styles.hintAccent}>Expériences</Text>.
      </Text>

      <View style={styles.themeList}>
        {ACTIVITY_THEMES.map((theme) => (
          <View key={theme.label} style={styles.themeCard}>
            <View style={styles.themeIconWrap}>
              <Ionicons name={theme.icon} size={20} color={DISCOVER_GREEN} />
            </View>
            <View style={styles.themeText}>
              <Text style={styles.themeLabel}>{theme.label}</Text>
              <Text style={styles.themeHint}>{theme.hint}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
  soonBanner: {
    backgroundColor: DISCOVER_CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.22)',
    padding: 18,
    gap: 8,
  },
  soonBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  soonBadgeText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontWeight: '800',
  },
  soonTitle: {
    color: '#F5F5F5',
    fontSize: 17,
    fontWeight: '900',
  },
  soonBody: {
    color: DISCOVER_MUTED,
    fontSize: 13,
    lineHeight: 19,
  },
  hint: {
    color: DISCOVER_MUTED,
    fontSize: 12,
    lineHeight: 18,
  },
  hintAccent: {
    color: DISCOVER_GREEN,
    fontWeight: '800',
  },
  themeList: {
    gap: 10,
  },
  themeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: DISCOVER_CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    opacity: 0.85,
  },
  themeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(139,197,63,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeText: {
    flex: 1,
    gap: 3,
  },
  themeLabel: {
    color: '#ECECEC',
    fontSize: 14,
    fontWeight: '800',
  },
  themeHint: {
    color: DISCOVER_MUTED,
    fontSize: 11,
    lineHeight: 16,
  },
});
