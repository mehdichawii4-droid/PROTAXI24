import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ExplorerActivitesTab,
  ExplorerExperiencesTab,
  ExplorerGuidesTab,
  ExplorerHebergementsTab,
  ExplorerTabBar,
  type ExplorerTabId,
} from '@/components/discover';
import {
  DISCOVER_BG,
  DISCOVER_CARD,
  DISCOVER_GREEN,
  DISCOVER_MUTED,
} from '@/components/discover/discoverTheme';
import { DISCOVER_NAV_SOURCE } from '@/constants/discoverCatalogV2';
import type { ExperienceOptionId } from '@/constants/experiencesPrivateCatalog';
import {
  getDiscoverFeaturedExperiences,
  getDiscoverGuideTeaser,
  getDiscoverHotelTeasers,
} from '@/services/discoverCatalogService';
import { navigateToExperiencesPrivate, navigateToHotelFromDiscover } from '@/utils/navigation';

export default function DiscoverGuelmaScreen() {
  const [activeTab, setActiveTab] = useState<ExplorerTabId>('experiences');

  const featured = useMemo(() => getDiscoverFeaturedExperiences(), []);
  const hotelTeasers = useMemo(() => getDiscoverHotelTeasers(), []);
  const guideTeaser = useMemo(() => getDiscoverGuideTeaser(), []);

  const discoverSource = (suffix?: string) =>
    suffix ? `${DISCOVER_NAV_SOURCE}-${suffix}` : DISCOVER_NAV_SOURCE;

  const openExperiencesPrivate = (
    label: string,
    options?: {
      experienceId?: string;
      sourceSuffix?: string;
      preselectOption?: ExperienceOptionId;
    },
  ) => {
    navigateToExperiencesPrivate(
      { source: DISCOVER_NAV_SOURCE, label },
      {
        experienceId: options?.experienceId,
        source: discoverSource(options?.sourceSuffix),
        preselectOption: options?.preselectOption,
      },
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      <LinearGradient
        colors={['rgba(139,197,63,0.06)', 'rgba(5,5,5,0)']}
        style={styles.topGlow}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.topBarCenter}>
            <MaterialCommunityIcons name="compass-outline" size={16} color={DISCOVER_GREEN} />
            <Text style={styles.topBarTitle}>EXPLORER · GUELMA</Text>
          </View>

          <View style={styles.iconBtnPlaceholder} />
        </View>

        <Text style={styles.hubIntro}>
          Tourisme officiel PROTAXI — choisissez une rubrique pour continuer.
        </Text>

        <ExplorerTabBar activeTab={activeTab} onSelectTab={setActiveTab} />

        {activeTab === 'experiences' ? (
          <ExplorerExperiencesTab
            items={featured}
            onSelectExperience={(experienceId) =>
              openExperiencesPrivate(`Expérience ${experienceId}`, {
                experienceId,
                sourceSuffix: 'experiences',
              })
            }
            onBrowseAll={() =>
              openExperiencesPrivate('Parcourir les expériences', {
                sourceSuffix: 'experiences-browse',
              })
            }
          />
        ) : null}

        {activeTab === 'activites' ? <ExplorerActivitesTab /> : null}

        {activeTab === 'guides' ? (
          <ExplorerGuidesTab
            teaser={guideTeaser}
            onPressReserve={() =>
              openExperiencesPrivate('Réserver avec un guide', {
                experienceId: guideTeaser.highlightExperienceId,
                sourceSuffix: 'guides',
                preselectOption: 'guide',
              })
            }
          />
        ) : null}

        {activeTab === 'hebergements' ? (
          <ExplorerHebergementsTab
            items={hotelTeasers}
            onPressTransfer={() =>
              navigateToHotelFromDiscover(
                { source: DISCOVER_NAV_SOURCE, label: 'Transfert hôtel' },
                discoverSource('hebergements'),
              )
            }
          />
        ) : null}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DISCOVER_BG,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    zIndex: 0,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: DISCOVER_CARD,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnPlaceholder: {
    width: 44,
    height: 44,
  },
  topBarCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topBarTitle: {
    color: DISCOVER_GREEN,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  hubIntro: {
    color: DISCOVER_MUTED,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
    fontWeight: '500',
  },
  bottomSpacer: {
    height: 12,
  },
});
