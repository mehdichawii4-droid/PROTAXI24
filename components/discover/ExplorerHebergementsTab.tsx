import { StyleSheet, Text, View } from 'react-native';

import DiscoverHotelTeasers from '@/components/discover/DiscoverHotelTeasers';
import { DISCOVER_CARD, DISCOVER_MUTED } from '@/components/discover/discoverTheme';
import type { DiscoverHotelTeaser } from '@/types/discover';

type ExplorerHebergementsTabProps = {
  items: DiscoverHotelTeaser[];
  onPressTransfer: () => void;
};

export default function ExplorerHebergementsTab({
  items,
  onPressTransfer,
}: ExplorerHebergementsTabProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>Transfert hôtel — pas un catalogue en ligne</Text>
        <Text style={styles.noticeBody}>
          Envoyez une demande de prise en charge ou de transfert depuis votre établissement.
          La liste des hôtels partenaires certifiés arrive prochainement dans l&apos;app.
        </Text>
      </View>

      <DiscoverHotelTeasers
        items={items}
        onPressTeaser={(teaser) => {
          if (!teaser.comingSoon) {
            onPressTransfer();
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  noticeCard: {
    backgroundColor: DISCOVER_CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginBottom: 8,
    gap: 6,
  },
  noticeTitle: {
    color: '#F0F0F0',
    fontSize: 15,
    fontWeight: '800',
  },
  noticeBody: {
    color: DISCOVER_MUTED,
    fontSize: 12,
    lineHeight: 18,
  },
});
