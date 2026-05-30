/**
 * Discover V2 — configuration éditoriale (sections, rangs, libellés).
 * Les SKU réservables restent exclusivement dans EXPERIENCES_V1.
 */

/** Expériences à la une — fusion « Signature » + « Featured » (ordre vitrine). */
export const DISCOVER_FEATURED_EXPERIENCE_IDS = [
  'hammam-debagh-signature',
  'guelma-romaine',
  'route-thermale-premium',
  'nature-maouna',
  'memoire-de-guelma',
  'traces-civilisations',
] as const;

/** Badges optionnels par expérience (carousel à la une). */
export const DISCOVER_FEATURED_BADGES: Partial<
  Record<(typeof DISCOVER_FEATURED_EXPERIENCE_IDS)[number], 'featured' | 'premium' | 'popular'>
> = {
  'hammam-debagh-signature': 'featured',
  'guelma-romaine': 'popular',
  'route-thermale-premium': 'premium',
  'nature-maouna': 'premium',
};

/** Circuits populaires — sous-ensemble éditorial. */
export const DISCOVER_POPULAR_EXPERIENCE_IDS = [
  'hammam-debagh-signature',
  'guelma-romaine',
  'nature-maouna',
  'memoire-de-guelma',
] as const;

/** Recommandations éditoriales V2.0 (sans perso Firestore). */
export const DISCOVER_RECOMMENDATIONS = [
  {
    experienceId: 'guelma-romaine',
    reason: 'Idéal pour une première découverte du patrimoine de Guelma.',
  },
  {
    experienceId: 'hammam-debagh-signature',
    reason: 'Notre expérience la plus demandée — nature et panorama El Guelmi.',
  },
  {
    experienceId: 'route-thermale-premium',
    reason: 'Journée bien-être sur le circuit thermal officiel.',
  },
] as const;

/** Best-seller éditorial — section Tendances (V2.0). */
export const DISCOVER_TRENDS_HIGHLIGHT = {
  experienceId: 'hammam-debagh-signature',
  badgeLabel: 'Best-seller PROTAXI',
  statLabel: 'Expérience phare',
  statValue: 'N°1 Guelma',
} as const;

export const DISCOVER_HOTEL_TEASERS = [
  {
    id: 'hotel-transfer',
    title: 'Transfert hôtel premium',
    subtitle: 'Prise en charge et excursions depuis votre établissement.',
    ctaLabel: 'Réserver un transfert hôtel',
    comingSoon: false,
  },
  {
    id: 'partner-hotels-listing',
    title: 'Hôtels partenaires certifiés',
    subtitle: 'Liste des établissements PROTAXI — bientôt disponible dans l’app.',
    ctaLabel: 'En savoir plus',
    comingSoon: true,
  },
] as const;

export const DISCOVER_GUIDE_TEASER = {
  title: 'Guides certifiés PROTAXI',
  description:
    'Ajoutez l’option « Guide local » à votre expérience privée. Un guide validé par PROTAXI vous sera assigné avant le départ.',
  ctaLabel: 'Voir les expériences avec guide',
  highlightExperienceId: 'guelma-romaine',
} as const;

export const DISCOVER_PHOTOGRAPHER_TEASER = {
  title: 'Souvenirs premium',
  description:
    'Immortalisez votre excursion avec l’option photographe sur nos circuits officiels.',
  ctaLabel: 'Ajouter un photographe',
  targetExperienceId: 'hammam-debagh-signature',
  preselectOption: 'photographer' as const,
} as const;

export const DISCOVER_NAV_SOURCE = 'discover-v2';
