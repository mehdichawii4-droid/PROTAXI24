import { StyleSheet, View } from 'react-native';

import DiscoverExperienceCard from '@/components/discover/DiscoverExperienceCard';
import DiscoverSectionHeader from '@/components/discover/DiscoverSectionHeader';
import type { DiscoverExperienceCardModel } from '@/types/discover';

type DiscoverRecommendationsListProps = {
  items: DiscoverExperienceCardModel[];
  onSelectExperience: (experienceId: string) => void;
};

export default function DiscoverRecommendationsList({
  items,
  onSelectExperience,
}: DiscoverRecommendationsListProps) {
  return (
    <>
      <DiscoverSectionHeader
        title="Recommandé pour vous"
        subtitle="Sélection éditoriale PROTAXI"
        style={styles.header}
      />
      <View style={styles.list}>
        {items.map((item) => (
          <DiscoverExperienceCard
            key={item.experienceId}
            item={item}
            variant="compact"
            onPress={() => onSelectExperience(item.experienceId)}
          />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 8,
  },
  list: {
    marginBottom: 28,
  },
});
