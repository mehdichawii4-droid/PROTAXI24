import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  DISCOVER_CARD,
  DISCOVER_GREEN,
  DISCOVER_MUTED,
} from '@/components/discover/discoverTheme';
import DiscoverSectionHeader from '@/components/discover/DiscoverSectionHeader';
import type { DiscoverPhotographerTeaser } from '@/types/discover';

type DiscoverPhotographerTeaserCardProps = {
  teaser: DiscoverPhotographerTeaser;
  onPress: () => void;
};

export default function DiscoverPhotographerTeaserCard({
  teaser,
  onPress,
}: DiscoverPhotographerTeaserCardProps) {
  return (
    <>
      <DiscoverSectionHeader
        title="Souvenirs premium"
        subtitle="Option photographe sur circuit officiel"
        style={styles.header}
      />
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="camera-outline" size={24} color={DISCOVER_GREEN} />
        </View>
        <Text style={styles.title}>{teaser.title}</Text>
        <Text style={styles.description}>{teaser.description}</Text>
        <TouchableOpacity style={styles.cta} activeOpacity={0.9} onPress={onPress}>
          <Ionicons name="images-outline" size={16} color="#111" />
          <Text style={styles.ctaText}>{teaser.ctaLabel}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: DISCOVER_CARD,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.18)',
    padding: 20,
    marginBottom: 28,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(139,197,63,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    color: '#F5F5F5',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  description: {
    color: DISCOVER_MUTED,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: DISCOVER_GREEN,
  },
  ctaText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },
});
