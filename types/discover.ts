import type { ExperienceOptionId } from '@/constants/experiencesPrivateCatalog';

export type DiscoverFeaturedBadge = 'featured' | 'popular' | 'premium' | 'best-seller';

/** Carte circuit Discover — dérivée de EXPERIENCES_V1 uniquement. */
export type DiscoverExperienceCardModel = {
  experienceId: string;
  title: string;
  hook: string;
  identityBadge: string;
  duration: string;
  priceLabel: string;
  siteBadgeLabel: string;
  cardInclusPreview: string[];
  featuredBadge?: DiscoverFeaturedBadge;
  recommendationReason?: string;
};

export type DiscoverRecommendationItem = {
  experienceId: string;
  reason: string;
};

export type DiscoverHotelTeaser = {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  comingSoon: boolean;
};

export type DiscoverGuideTeaser = {
  title: string;
  description: string;
  ctaLabel: string;
  highlightExperienceId: string;
};

export type DiscoverPhotographerTeaser = {
  title: string;
  description: string;
  ctaLabel: string;
  targetExperienceId: string;
  preselectOption: Extract<ExperienceOptionId, 'photographer'>;
};

export type DiscoverTrendsHighlight = {
  experienceId: string;
  title: string;
  hook: string;
  badgeLabel: string;
  statLabel: string;
  statValue: string;
};

export type DiscoverExperienceNavigationParams = {
  experienceId: string;
  source: string;
  preselectOption?: ExperienceOptionId;
};
