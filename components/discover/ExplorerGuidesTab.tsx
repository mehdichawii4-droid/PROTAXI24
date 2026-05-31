import { StyleSheet, Text, View } from 'react-native';

import DiscoverGuideTeaserCard from '@/components/discover/DiscoverGuideTeaser';
import DiscoverWhyProtaxi from '@/components/discover/DiscoverWhyProtaxi';
import { DISCOVER_MUTED } from '@/components/discover/discoverTheme';
import type { DiscoverGuideTeaser } from '@/types/discover';

type ExplorerGuidesTabProps = {
  teaser: DiscoverGuideTeaser;
  onPressReserve: () => void;
};

export default function ExplorerGuidesTab({ teaser, onPressReserve }: ExplorerGuidesTabProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.intro}>
        Les guides PROTAXI ne se réservent pas seuls : ajoutez l&apos;option « Guide local »
        à une expérience privée officielle. PROTAXI vous assigne un guide certifié avant le
        départ.
      </Text>

      <DiscoverGuideTeaserCard teaser={teaser} onPress={onPressReserve} />

      <DiscoverWhyProtaxi />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  intro: {
    color: DISCOVER_MUTED,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    marginBottom: 4,
  },
});
