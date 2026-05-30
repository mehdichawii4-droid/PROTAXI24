import { ScrollView, StyleSheet } from 'react-native';

import DiscoverExperienceCard from '@/components/discover/DiscoverExperienceCard';
import DiscoverSectionHeader from '@/components/discover/DiscoverSectionHeader';
import type { DiscoverExperienceCardModel } from '@/types/discover';

type DiscoverFeaturedCarouselProps = {
  items: DiscoverExperienceCardModel[];
  onSelectExperience: (experienceId: string) => void;
};

export default function DiscoverFeaturedCarousel({
  items,
  onSelectExperience,
}: DiscoverFeaturedCarouselProps) {
  return (
    <>
      <DiscoverSectionHeader
        title="Expériences à la une"
        subtitle="Les six expériences officielles PROTAXI — réservation privée"
        style={styles.header}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        decelerationRate="fast"
      >
        {items.map((item) => (
          <DiscoverExperienceCard
            key={item.experienceId}
            item={item}
            variant="featured"
            onPress={() => onSelectExperience(item.experienceId)}
          />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 12,
  },
  row: {
    gap: 14,
    paddingRight: 4,
    marginBottom: 28,
  },
});
