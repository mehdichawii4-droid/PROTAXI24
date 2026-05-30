import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  DISCOVER_CARD,
  DISCOVER_GREEN,
  DISCOVER_RADIUS_MD,
  discoverPremiumGlow,
  discoverTextShadow,
} from '@/components/discover/discoverTheme';
import { getExperienceV1 } from '@/constants/experiencesPrivateCatalog';
import { getExperienceV1Image } from '@/constants/experienceVisuals';
import type { DiscoverExperienceCardModel, DiscoverFeaturedBadge } from '@/types/discover';

type DiscoverExperienceCardProps = {
  item: DiscoverExperienceCardModel;
  variant: 'featured' | 'popular' | 'compact';
  onPress: () => void;
};

function badgeLabel(badge?: DiscoverFeaturedBadge): string | null {
  switch (badge) {
    case 'featured':
      return 'À la une';
    case 'popular':
      return 'Populaire';
    case 'premium':
      return 'Premium';
    case 'best-seller':
      return 'Best-seller';
    default:
      return null;
  }
}

function badgeIcon(badge?: DiscoverFeaturedBadge) {
  if (badge === 'premium') return 'diamond-outline';
  if (badge === 'featured') return 'sparkles-outline';
  return 'flame';
}

export default function DiscoverExperienceCard({
  item,
  variant,
  onPress,
}: DiscoverExperienceCardProps) {
  const experience = getExperienceV1(item.experienceId);
  const image = experience ? getExperienceV1Image(experience) : null;
  const label = badgeLabel(item.featuredBadge);

  if (variant === 'popular') {
    return (
      <Pressable
        style={({ pressed }) => [styles.popularCard, pressed && styles.pressed]}
        onPress={onPress}
      >
        {image ? <Image source={image} style={styles.popularImage} resizeMode="cover" /> : null}
        <LinearGradient
          colors={['rgba(5,5,5,0.05)', 'rgba(5,5,5,0.55)', 'rgba(5,5,5,0.96)']}
          locations={[0, 0.42, 1]}
          style={styles.popularGradient}
        />
        {label ? (
          <View style={styles.popularBadge}>
            <Ionicons name="flame" size={11} color="#111" />
            <Text style={styles.popularBadgeText}>{label}</Text>
          </View>
        ) : null}
        <View style={styles.popularContent}>
          <Text style={styles.popularTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.popularMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={13} color={DISCOVER_GREEN} />
              <Text style={styles.metaText}>{item.duration}</Text>
            </View>
            <Text style={styles.priceText}>{item.priceLabel}</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  if (variant === 'compact') {
    return (
      <Pressable
        style={({ pressed }) => [styles.compactCard, pressed && styles.pressed]}
        onPress={onPress}
      >
        <View style={styles.compactTextWrap}>
          <Text style={styles.compactEyebrow}>{item.identityBadge}</Text>
          <Text style={styles.compactTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.recommendationReason ? (
            <Text style={styles.compactReason} numberOfLines={2}>
              {item.recommendationReason}
            </Text>
          ) : (
            <Text style={styles.compactHook} numberOfLines={2}>
              {item.hook}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={DISCOVER_GREEN} />
      </Pressable>
    );
  }

  return (
    <View style={styles.featuredCard}>
      {image ? <Image source={image} style={styles.featuredImage} resizeMode="cover" /> : null}
      <LinearGradient
        colors={['rgba(5,5,5,0.08)', 'rgba(5,5,5,0.62)', 'rgba(5,5,5,0.98)']}
        locations={[0, 0.38, 1]}
        style={styles.featuredGradient}
      />
      {label ? (
        <View
          style={[
            styles.featuredBadge,
            item.featuredBadge === 'premium' && styles.featuredBadgePremium,
          ]}
        >
          <Ionicons name={badgeIcon(item.featuredBadge)} size={11} color="#111" />
          <Text style={styles.featuredBadgeText}>{label}</Text>
        </View>
      ) : null}
      <View style={styles.featuredContent}>
        <Text style={styles.featuredEyebrow}>{item.identityBadge}</Text>
        <Text style={styles.featuredTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.featuredHook} numberOfLines={2}>
          {item.hook}
        </Text>
        <View style={styles.featuredMetaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={12} color={DISCOVER_GREEN} />
            <Text style={styles.metaText}>{item.duration}</Text>
          </View>
          <Text style={styles.siteBadge}>{item.siteBadgeLabel}</Text>
        </View>
        <TouchableOpacity style={styles.exploreBtn} activeOpacity={0.9} onPress={onPress}>
          <Text style={styles.exploreText}>Réserver</Text>
          <Ionicons name="arrow-forward" size={14} color="#111" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  featuredCard: {
    width: 280,
    height: 380,
    borderRadius: DISCOVER_RADIUS_MD,
    overflow: 'hidden',
    backgroundColor: DISCOVER_CARD,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...discoverPremiumGlow,
  },
  featuredImage: {
    ...StyleSheet.absoluteFillObject,
  },
  featuredGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  featuredBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: DISCOVER_GREEN,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    zIndex: 2,
  },
  featuredBadgePremium: {
    backgroundColor: '#C9A227',
  },
  featuredBadgeText: {
    color: '#111',
    fontSize: 10,
    fontWeight: '900',
  },
  featuredContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 18,
  },
  featuredEyebrow: {
    color: DISCOVER_GREEN,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  featuredTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    ...discoverTextShadow,
  },
  featuredHook: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  featuredMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  siteBadge: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '600',
    maxWidth: 120,
    textAlign: 'right',
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: DISCOVER_GREEN,
  },
  exploreText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },
  popularCard: {
    width: 210,
    height: 250,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: DISCOVER_CARD,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  popularImage: {
    ...StyleSheet.absoluteFillObject,
  },
  popularGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  popularBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: DISCOVER_GREEN,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 2,
  },
  popularBadgeText: {
    color: '#111',
    fontSize: 9,
    fontWeight: '900',
  },
  popularContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 14,
  },
  popularTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    ...discoverTextShadow,
  },
  popularMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  priceText: {
    color: DISCOVER_GREEN,
    fontSize: 11,
    fontWeight: '800',
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: DISCOVER_CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  compactTextWrap: {
    flex: 1,
    gap: 3,
  },
  compactEyebrow: {
    color: DISCOVER_GREEN,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  compactTitle: {
    color: '#F5F5F5',
    fontSize: 15,
    fontWeight: '800',
  },
  compactReason: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    lineHeight: 17,
  },
  compactHook: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    lineHeight: 17,
  },
});
