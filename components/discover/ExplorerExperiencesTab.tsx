import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { DISCOVER_CARD, DISCOVER_GREEN, DISCOVER_MUTED } from '@/components/discover/discoverTheme';
import { getExperienceV1 } from '@/constants/experiencesPrivateCatalog';
import { getExperienceV1Image } from '@/constants/experienceVisuals';
import type { DiscoverExperienceCardModel } from '@/types/discover';

type ExplorerExperiencesTabProps = {
  items: DiscoverExperienceCardModel[];
  onSelectExperience: (experienceId: string) => void;
  onBrowseAll: () => void;
};

export default function ExplorerExperiencesTab({
  items,
  onSelectExperience,
  onBrowseAll,
}: ExplorerExperiencesTabProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.intro}>
        Six expériences privées officielles PROTAXI — réservation directe ci-dessous.
      </Text>

      <View style={styles.list}>
        {items.map((item) => {
          const experience = getExperienceV1(item.experienceId);
          const image = experience ? getExperienceV1Image(experience) : null;

          return (
            <Pressable
              key={item.experienceId}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => onSelectExperience(item.experienceId)}
            >
              {image ? (
                <Image source={image} style={styles.thumb} resizeMode="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]} />
              )}
              <View style={styles.content}>
                <Text style={styles.eyebrow}>{item.identityBadge}</Text>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.hook} numberOfLines={2}>
                  {item.hook}
                </Text>
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={12} color={DISCOVER_GREEN} />
                  <Text style={styles.meta}>{item.duration}</Text>
                  <Text style={styles.price}>{item.priceLabel}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={DISCOVER_GREEN} />
            </Pressable>
          );
        })}
      </View>

      <TouchableOpacity style={styles.browseBtn} activeOpacity={0.9} onPress={onBrowseAll}>
        <Text style={styles.browseBtnText}>Parcourir toutes les options</Text>
        <Ionicons name="arrow-forward" size={16} color="#111" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  intro: {
    color: DISCOVER_MUTED,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: DISCOVER_CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
  },
  pressed: {
    opacity: 0.92,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 14,
  },
  thumbPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    color: DISCOVER_GREEN,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  title: {
    color: '#F5F5F5',
    fontSize: 15,
    fontWeight: '800',
  },
  hook: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  meta: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  price: {
    color: DISCOVER_GREEN,
    fontSize: 10,
    fontWeight: '800',
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: DISCOVER_GREEN,
  },
  browseBtnText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },
});
