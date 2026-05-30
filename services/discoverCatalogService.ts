import {
  DISCOVER_FEATURED_BADGES,
  DISCOVER_FEATURED_EXPERIENCE_IDS,
  DISCOVER_GUIDE_TEASER,
  DISCOVER_HOTEL_TEASERS,
  DISCOVER_PHOTOGRAPHER_TEASER,
  DISCOVER_POPULAR_EXPERIENCE_IDS,
  DISCOVER_RECOMMENDATIONS,
  DISCOVER_TRENDS_HIGHLIGHT,
} from '@/constants/discoverCatalogV2';
import {
  EXPERIENCE_PRICE_LABEL,
  EXPERIENCES_V1,
  getExperienceCardInclusPreview,
  getExperienceSiteBadgeLabel,
  getExperienceV1,
  type ExperienceV1,
} from '@/constants/experiencesPrivateCatalog';
import type {
  DiscoverExperienceCardModel,
  DiscoverGuideTeaser,
  DiscoverHotelTeaser,
  DiscoverPhotographerTeaser,
  DiscoverRecommendationItem,
  DiscoverTrendsHighlight,
} from '@/types/discover';

function requireExperience(experienceId: string): ExperienceV1 {
  const experience = getExperienceV1(experienceId);
  if (!experience) {
    throw new Error(`Unknown experience id: ${experienceId}`);
  }
  return experience;
}

export function mapExperienceToDiscoverCard(
  experience: ExperienceV1,
  extras?: Pick<DiscoverExperienceCardModel, 'featuredBadge' | 'recommendationReason'>,
): DiscoverExperienceCardModel {
  return {
    experienceId: experience.id,
    title: experience.title,
    hook: experience.hook,
    identityBadge: experience.identityBadge,
    duration: experience.duration,
    priceLabel: EXPERIENCE_PRICE_LABEL,
    siteBadgeLabel: getExperienceSiteBadgeLabel(experience),
    cardInclusPreview: getExperienceCardInclusPreview(experience),
    featuredBadge: extras?.featuredBadge,
    recommendationReason: extras?.recommendationReason,
  };
}

export function getDiscoverFeaturedExperiences(): DiscoverExperienceCardModel[] {
  return DISCOVER_FEATURED_EXPERIENCE_IDS.map((experienceId) => {
    const experience = requireExperience(experienceId);
    return mapExperienceToDiscoverCard(experience, {
      featuredBadge: DISCOVER_FEATURED_BADGES[experienceId],
    });
  });
}

export function getDiscoverPopularExperiences(): DiscoverExperienceCardModel[] {
  return DISCOVER_POPULAR_EXPERIENCE_IDS.map((experienceId) =>
    mapExperienceToDiscoverCard(requireExperience(experienceId), {
      featuredBadge: 'popular',
    }),
  );
}

export function getDiscoverRecommendations(): DiscoverExperienceCardModel[] {
  return DISCOVER_RECOMMENDATIONS.map((item: DiscoverRecommendationItem) =>
    mapExperienceToDiscoverCard(requireExperience(item.experienceId), {
      recommendationReason: item.reason,
    }),
  );
}

export function getDiscoverTrendsHighlight(): DiscoverTrendsHighlight {
  const experience = requireExperience(DISCOVER_TRENDS_HIGHLIGHT.experienceId);
  return {
    experienceId: experience.id,
    title: experience.title,
    hook: experience.hook,
    badgeLabel: DISCOVER_TRENDS_HIGHLIGHT.badgeLabel,
    statLabel: DISCOVER_TRENDS_HIGHLIGHT.statLabel,
    statValue: DISCOVER_TRENDS_HIGHLIGHT.statValue,
  };
}

export function getDiscoverHotelTeasers(): DiscoverHotelTeaser[] {
  return [...DISCOVER_HOTEL_TEASERS];
}

export function getDiscoverGuideTeaser(): DiscoverGuideTeaser {
  return { ...DISCOVER_GUIDE_TEASER };
}

export function getDiscoverPhotographerTeaser(): DiscoverPhotographerTeaser {
  return { ...DISCOVER_PHOTOGRAPHER_TEASER };
}

/** Vérifie que la config Discover ne référence que des SKU V1 valides. */
export function validateDiscoverV2CatalogConfig() {
  const errors: string[] = [];
  const validIds = new Set(EXPERIENCES_V1.map((item) => item.id));

  const allReferencedIds = [
    ...DISCOVER_FEATURED_EXPERIENCE_IDS,
    ...DISCOVER_POPULAR_EXPERIENCE_IDS,
    ...DISCOVER_RECOMMENDATIONS.map((item) => item.experienceId),
    DISCOVER_TRENDS_HIGHLIGHT.experienceId,
    DISCOVER_GUIDE_TEASER.highlightExperienceId,
    DISCOVER_PHOTOGRAPHER_TEASER.targetExperienceId,
  ];

  for (const id of allReferencedIds) {
    if (!validIds.has(id)) {
      errors.push(`Discover config references unknown experience: ${id}`);
    }
  }

  if (DISCOVER_FEATURED_EXPERIENCE_IDS.length !== 6) {
    errors.push(`Featured list must include all 6 experiences, got ${DISCOVER_FEATURED_EXPERIENCE_IDS.length}`);
  }

  return { ok: errors.length === 0, errors };
}
