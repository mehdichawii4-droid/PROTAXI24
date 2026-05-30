import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DiscoverFeaturedCarousel,
  DiscoverGuideTeaserCard,
  DiscoverHero,
  DiscoverHotelTeasers,
  DiscoverPhotographerTeaserCard,
  DiscoverPopularRow,
  DiscoverRecommendationsList,
  DiscoverTrendsHighlightCard,
  DiscoverWhyProtaxi,
} from '@/components/discover';
import {
  DISCOVER_BG,
  DISCOVER_CARD,
  DISCOVER_GREEN,
} from '@/components/discover/discoverTheme';
import { DISCOVER_NAV_SOURCE } from '@/constants/discoverCatalogV2';
import type { ExperienceOptionId } from '@/constants/experiencesPrivateCatalog';
import {
  getDiscoverFeaturedExperiences,
  getDiscoverGuideTeaser,
  getDiscoverHotelTeasers,
  getDiscoverPhotographerTeaser,
  getDiscoverPopularExperiences,
  getDiscoverRecommendations,
  getDiscoverTrendsHighlight,
} from '@/services/discoverCatalogService';
import { logNavigation, PROTAXI_ROUTES } from '@/utils/navigation';

function pushRoute(
  pathname: Href,
  params: Record<string, string>,
  label: string,
) {
  const routePath = typeof pathname === 'string' ? pathname : String(pathname);
  const paramSummary = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  const routeLabel = paramSummary ? `${routePath}?${paramSummary}` : routePath;
  logNavigation(routeLabel, { source: DISCOVER_NAV_SOURCE, label });
  router.push({ pathname, params } as Href);
}

function FadeSlideIn({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 520,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

export default function DiscoverGuelmaScreen() {
  const featured = useMemo(() => getDiscoverFeaturedExperiences(), []);
  const popular = useMemo(() => getDiscoverPopularExperiences(), []);
  const recommendations = useMemo(() => getDiscoverRecommendations(), []);
  const trendsHighlight = useMemo(() => getDiscoverTrendsHighlight(), []);
  const hotelTeasers = useMemo(() => getDiscoverHotelTeasers(), []);
  const guideTeaser = useMemo(() => getDiscoverGuideTeaser(), []);
  const photographerTeaser = useMemo(() => getDiscoverPhotographerTeaser(), []);

  const openExperiencesPrivate = (
    label: string,
    options?: {
      experienceId?: string;
      sourceSuffix?: string;
      preselectOption?: ExperienceOptionId;
    },
  ) => {
    const params: Record<string, string> = {
      source: options?.sourceSuffix
        ? `${DISCOVER_NAV_SOURCE}-${options.sourceSuffix}`
        : DISCOVER_NAV_SOURCE,
    };
    if (options?.experienceId) {
      params.experienceId = options.experienceId;
    }
    if (options?.preselectOption) {
      params.preselectOption = options.preselectOption;
    }
    pushRoute(PROTAXI_ROUTES.experiencesPrivate, params, label);
  };

  const bookCityTaxi = () => {
    pushRoute(PROTAXI_ROUTES.city, { source: DISCOVER_NAV_SOURCE }, 'Besoin d\'un taxi en ville ?');
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
        <FadeSlideIn>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.topBarCenter}>
              <MaterialCommunityIcons name="compass-outline" size={16} color={DISCOVER_GREEN} />
              <Text style={styles.topBarTitle}>TOURISME GUELMA</Text>
            </View>

            <View style={styles.iconBtnPlaceholder} />
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={60}>
          <DiscoverHero
            onPressCta={() =>
              openExperiencesPrivate('Voir les expériences privées', { sourceSuffix: 'hero' })
            }
          />
        </FadeSlideIn>

        <FadeSlideIn delay={100}>
          <DiscoverFeaturedCarousel
            items={featured}
            onSelectExperience={(experienceId) =>
              openExperiencesPrivate(`Expérience ${experienceId}`, {
                experienceId,
                sourceSuffix: 'featured',
              })
            }
          />
        </FadeSlideIn>

        <FadeSlideIn delay={120}>
          <DiscoverPopularRow
            items={popular}
            onSelectExperience={(experienceId) =>
              openExperiencesPrivate(`Circuit ${experienceId}`, {
                experienceId,
                sourceSuffix: 'popular',
              })
            }
          />
        </FadeSlideIn>

        <FadeSlideIn delay={150}>
          <DiscoverRecommendationsList
            items={recommendations}
            onSelectExperience={(experienceId) =>
              openExperiencesPrivate(`Recommandation ${experienceId}`, {
                experienceId,
                sourceSuffix: 'recommended',
              })
            }
          />
        </FadeSlideIn>

        <FadeSlideIn delay={180}>
          <DiscoverTrendsHighlightCard
            highlight={trendsHighlight}
            onPress={() =>
              openExperiencesPrivate(`Tendance ${trendsHighlight.experienceId}`, {
                experienceId: trendsHighlight.experienceId,
                sourceSuffix: 'trends',
              })
            }
          />
        </FadeSlideIn>

        <FadeSlideIn delay={210}>
          <DiscoverHotelTeasers
            items={hotelTeasers}
            onPressTeaser={() =>
              pushRoute(
                PROTAXI_ROUTES.hotel,
                { source: DISCOVER_NAV_SOURCE },
                'Transfert hôtel premium',
              )
            }
          />
        </FadeSlideIn>

        <FadeSlideIn delay={270}>
          <DiscoverGuideTeaserCard
            teaser={guideTeaser}
            onPress={() =>
              openExperiencesPrivate('Guides certifiés PROTAXI', {
                experienceId: guideTeaser.highlightExperienceId,
                sourceSuffix: 'guide-teaser',
              })
            }
          />
        </FadeSlideIn>

        <FadeSlideIn delay={330}>
          <DiscoverPhotographerTeaserCard
            teaser={photographerTeaser}
            onPress={() =>
              openExperiencesPrivate('Option photographe', {
                experienceId: photographerTeaser.targetExperienceId,
                sourceSuffix: 'photographer-teaser',
                preselectOption: photographerTeaser.preselectOption,
              })
            }
          />
        </FadeSlideIn>

        <FadeSlideIn delay={390}>
          <DiscoverWhyProtaxi />
        </FadeSlideIn>

        <FadeSlideIn delay={450}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.9}
            onPress={bookCityTaxi}
          >
            <Ionicons name="car-sport-outline" size={18} color={DISCOVER_GREEN} />
            <Text style={styles.secondaryBtnText}>Besoin d&apos;un taxi en ville ?</Text>
            <Ionicons name="chevron-forward" size={16} color={DISCOVER_GREEN} />
          </TouchableOpacity>
        </FadeSlideIn>

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
    marginBottom: 16,
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
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.28)',
    backgroundColor: 'rgba(139,197,63,0.06)',
  },
  secondaryBtnText: {
    color: DISCOVER_GREEN,
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 12,
  },
});
