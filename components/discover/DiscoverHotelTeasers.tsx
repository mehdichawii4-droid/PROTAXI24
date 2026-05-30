import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  DISCOVER_CARD,
  DISCOVER_GREEN,
  DISCOVER_MUTED,
} from '@/components/discover/discoverTheme';
import DiscoverSectionHeader from '@/components/discover/DiscoverSectionHeader';
import type { DiscoverHotelTeaser } from '@/types/discover';

type DiscoverHotelTeasersProps = {
  items: DiscoverHotelTeaser[];
  onPressTeaser: (teaser: DiscoverHotelTeaser) => void;
};

export default function DiscoverHotelTeasers({
  items,
  onPressTeaser,
}: DiscoverHotelTeasersProps) {
  return (
    <>
      <DiscoverSectionHeader
        title="Hôtels partenaires"
        subtitle="Transferts premium et séjours certifiés PROTAXI"
        style={styles.header}
      />
      <View style={styles.list}>
        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="bed-outline" size={22} color={DISCOVER_GREEN} />
            </View>
            <View style={styles.content}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
              {item.comingSoon ? (
                <View style={styles.soonBadge}>
                  <Text style={styles.soonText}>Bientôt</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.cta}
                  activeOpacity={0.9}
                  onPress={() => onPressTeaser(item)}
                >
                  <Text style={styles.ctaText}>{item.ctaLabel}</Text>
                  <Ionicons name="arrow-forward" size={14} color="#111" />
                </TouchableOpacity>
              )}
            </View>
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
  list: {
    gap: 12,
    marginBottom: 28,
  },
  card: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: DISCOVER_CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(139,197,63,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 6,
  },
  title: {
    color: '#F5F5F5',
    fontSize: 15,
    fontWeight: '800',
  },
  subtitle: {
    color: DISCOVER_MUTED,
    fontSize: 12,
    lineHeight: 17,
  },
  soonBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  soonText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '700',
  },
  cta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: DISCOVER_GREEN,
  },
  ctaText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '900',
  },
});
