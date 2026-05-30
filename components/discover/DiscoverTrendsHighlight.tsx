import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  DISCOVER_CARD,
  DISCOVER_GREEN,
  DISCOVER_RADIUS_MD,
  discoverPremiumGlow,
} from '@/components/discover/discoverTheme';
import DiscoverSectionHeader from '@/components/discover/DiscoverSectionHeader';
import { getExperienceV1 } from '@/constants/experiencesPrivateCatalog';
import { getExperienceV1Image } from '@/constants/experienceVisuals';
import type { DiscoverTrendsHighlight } from '@/types/discover';

type DiscoverTrendsHighlightCardProps = {
  highlight: DiscoverTrendsHighlight;
  onPress: () => void;
};

export default function DiscoverTrendsHighlightCard({
  highlight,
  onPress,
}: DiscoverTrendsHighlightCardProps) {
  const experience = getExperienceV1(highlight.experienceId);
  const image = experience ? getExperienceV1Image(experience) : null;

  return (
    <>
      <DiscoverSectionHeader
        title="Tendances PROTAXI"
        subtitle="Best-seller éditorial — expérience phare"
        style={styles.header}
      />
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={onPress}
      >
        <View style={styles.glow} />
        {image ? (
          <>
            <Image source={image} style={styles.image} resizeMode="cover" />
            <LinearGradient
              colors={['rgba(5,5,5,0.2)', 'rgba(5,5,5,0.75)', 'rgba(5,5,5,0.98)']}
              style={styles.imageGradient}
            />
          </>
        ) : null}
        <View style={styles.badgeRow}>
          <View style={styles.bestSellerBadge}>
            <Ionicons name="trophy-outline" size={14} color="#111" />
            <Text style={styles.bestSellerText}>{highlight.badgeLabel.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.title}>{highlight.title}</Text>
        <Text style={styles.hook} numberOfLines={2}>
          {highlight.hook}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{highlight.statValue}</Text>
            <Text style={styles.statLabel}>{highlight.statLabel}</Text>
          </View>
          <View style={styles.ctaPill}>
            <Text style={styles.ctaText}>Réserver</Text>
            <Ionicons name="arrow-forward" size={14} color="#111" />
          </View>
        </View>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: DISCOVER_CARD,
    borderRadius: DISCOVER_RADIUS_MD,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.32)',
    padding: 18,
    marginBottom: 28,
    overflow: 'hidden',
    minHeight: 180,
    ...discoverPremiumGlow,
  },
  pressed: {
    opacity: 0.94,
  },
  glow: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 110,
    height: 110,
    borderRadius: 999,
    backgroundColor: 'rgba(139,197,63,0.12)',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
  },
  imageGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  bestSellerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: DISCOVER_GREEN,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  bestSellerText: {
    color: '#111',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 6,
  },
  hook: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statValue: {
    color: DISCOVER_GREEN,
    fontSize: 16,
    fontWeight: '900',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  ctaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: DISCOVER_GREEN,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ctaText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '900',
  },
});
