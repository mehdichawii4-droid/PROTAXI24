import { ScrollView, StyleSheet } from 'react-native';

import DiscoverExperienceCard from '@/components/discover/DiscoverExperienceCard';
import DiscoverSectionHeader from '@/components/discover/DiscoverSectionHeader';
import type { DiscoverExperienceCardModel } from '@/types/discover';

type DiscoverPopularRowProps = {
  items: DiscoverExperienceCardModel[];
  onSelectExperience: (experienceId: string) => void;
};

export default function DiscoverPopularRow({
  items,
  onSelectExperience,
}: DiscoverPopularRowProps) {
  return (
    <>
      <DiscoverSectionHeader
        title="Circuits populaires"
        subtitle="Les incontournables de la wilaya"
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
            variant="popular"
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
    gap: 12,
    paddingRight: 4,
    marginBottom: 28,
  },
});
