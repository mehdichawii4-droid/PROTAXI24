export type ExperienceBookingMode = 'private' | 'group';

export type ExperienceOptionId =
  | 'guide'
  | 'photographer'
  | 'premium_vehicle'
  | 'traditional_lunch'
  | 'picnic'
  | 'spa_access';

export type ExperienceOptionDef = {
  id: ExperienceOptionId;
  label: string;
};

export const EXPERIENCE_OPTION_CATALOG: Record<ExperienceOptionId, ExperienceOptionDef> = {
  guide: { id: 'guide', label: 'Guide local' },
  photographer: { id: 'photographer', label: 'Photographe' },
  premium_vehicle: { id: 'premium_vehicle', label: 'Véhicule premium' },
  traditional_lunch: { id: 'traditional_lunch', label: 'Déjeuner traditionnel' },
  picnic: { id: 'picnic', label: 'Pique-nique' },
  spa_access: { id: 'spa_access', label: 'Accès spa' },
};

export type ExperienceV1 = {
  id: string;
  title: string;
  circuitName: string;
  duration: string;
  /** Badge d'identité — carte étape 2 */
  identityBadge: string;
  /** Accroche émotionnelle — carte étape 2 */
  hook: string;
  /** Sites / étapes — carte étape 2 (badge + puces) */
  cardInclus: string[];
  /** Libellé guide premium — carte étape 2 */
  guideAvailability: string;
  /** Étapes réservation / Firestore (inchangé métier) */
  highlights: string[];
  /** Bannière étape 4 — inchangé */
  recommendedGuide?: string;
  availableOptions: ExperienceOptionId[];
  bookingMode: 'private';
};

const PROTAXI_INCLUDES = [
  'Transport privé PROTAXI',
  'Chauffeur privé PROTAXI',
  'Conciergerie PROTAXI',
];

export const EXPERIENCE_PRICE_LABEL = 'Sur confirmation';

export const EXPERIENCE_MEETING_PLACEHOLDER = 'À confirmer par PROTAXI';

export const EXPERIENCE_SOURCE = 'experiences-private';

export const PRIVATE_FORMULA_LABEL = 'Expérience privée';

export const GROUP_FORMULA_LABEL = 'Expérience groupe';

export const FORMULA_PRIVATE_PERKS = [
  'Véhicule privé PROTAXI',
  'Chauffeur dédié',
  'Horaires flexibles',
  'Expérience exclusive',
] as const;

export const FORMULA_GROUP_PERKS = [
  'Tarif avantageux',
  'Expérience partagée',
  'Départ collectif',
  'Places limitées',
] as const;

const CARD_INCLUS_VISIBLE_MAX = 3;

/** Catalogue officiel lancement Guelma — expériences privées uniquement. */
export const EXPERIENCES_V1: ExperienceV1[] = [
  {
    id: 'hammam-debagh-signature',
    title: 'Hammam Debagh Signature',
    circuitName: 'Hammam Debagh Signature',
    duration: 'Demi-journée',
    identityBadge: '🔥 Expérience la plus populaire',
    hook: 'Admirez Guelma depuis El Guelmi, puis vivez la magie de Hammam Debagh.',
    cardInclus: [
      'Belvédère El Guelmi',
      'Cascade de Hammam Debagh',
      'Cônes calcaires',
      'Sources thermales',
      'Point photo & pause nature',
    ],
    guideAvailability: 'Guide nature & patrimoine disponible',
    highlights: [
      'Panorama El Guelmi — vue sur Guelma',
      'Cascade de Hammam Debagh',
      'Cônes calcaires de Debagh',
      'Sources thermales & vestiges naturels',
      'Pause bien-être / bain thermal',
    ],
    availableOptions: ['guide', 'photographer', 'traditional_lunch', 'premium_vehicle'],
    bookingMode: 'private',
  },
  {
    id: 'guelma-romaine',
    title: 'Guelma Romaine',
    circuitName: 'Guelma Romaine',
    duration: 'Demi-journée',
    identityBadge: '🏛️ Incontournable patrimoine',
    hook: 'Voyagez à travers plus de 2000 ans d’histoire au cœur de l’ancienne cité de Calama.',
    cardInclus: [
      'Théâtre romain',
      'Jardin archéologique',
      'Thermes romains',
      'Piscine romaine',
      'Vestiges byzantins',
    ],
    guideAvailability: 'Guide patrimoine disponible',
    highlights: [
      'Cité antique de Calama (cœur historique de Guelma)',
      'Théâtre romain de Guelma',
      'Jardin archéologique de Calama',
      'Thermes romains et vestiges',
      'Piscine romaine monumentale',
      'Parcours patrimonial centre-ville',
    ],
    recommendedGuide: 'Guide patrimoine & archéologie recommandé',
    availableOptions: ['guide', 'photographer', 'premium_vehicle', 'traditional_lunch'],
    bookingMode: 'private',
  },
  {
    id: 'nature-maouna',
    title: 'Nature Maouna',
    circuitName: 'Nature Maouna',
    duration: 'Journée',
    identityBadge: '🌿 Nature & panoramas',
    hook: 'Explorez les hauteurs verdoyantes de Maouna et profitez des plus beaux panoramas de Guelma.',
    cardInclus: [
      'Forêt Ain Safra',
      'Djebel Maouna',
      'Points panoramiques',
      'Pause nature',
    ],
    guideAvailability: 'Guide local disponible',
    highlights: [
      'Forêt Maouna',
      'Ain Sefra',
      'Points panoramiques',
      'Pause détente',
    ],
    availableOptions: ['guide', 'photographer', 'picnic', 'premium_vehicle'],
    bookingMode: 'private',
  },
  {
    id: 'memoire-de-guelma',
    title: 'Mémoire de Guelma',
    circuitName: 'Mémoire de Guelma',
    duration: 'Demi-journée',
    identityBadge: '🇩🇿 Mémoire nationale',
    hook:
      'Du départ de la marche du 8 mai aux lieux de mémoire : un parcours émotionnel au cœur de Guelma.',
    cardInclus: [
      'Départ de la marche du 8 mai 1945',
      'Fresque des martyrs',
      'Four à chaux',
      'Monument commémoratif des martyrs',
      'Musée El Moudjahid',
      'Maison Houari Boumediene',
    ],
    guideAvailability: 'Guide historique & mémoire disponible',
    highlights: [
      'Départ de la marche du 8 mai 1945',
      'Fresque des martyrs & ancienne caserne',
      'Gare ferroviaire historique & Kef El-Bomba',
      'Four à chaux',
      'Monument commémoratif des martyrs',
      'Musée El Moudjahid',
      'Maison Houari Boumediene',
    ],
    recommendedGuide: 'Guide historique & mémoire recommandé',
    availableOptions: ['guide', 'photographer', 'premium_vehicle', 'traditional_lunch'],
    bookingMode: 'private',
  },
  {
    id: 'traces-civilisations',
    title: 'Sur les Traces des Civilisations',
    circuitName: 'Sur les Traces des Civilisations',
    duration: 'Journée',
    identityBadge: '🏺 Archéologie & civilisations',
    hook:
      'De Thibilis aux tombes mégalithiques : une journée sur les traces des premières civilisations de Guelma.',
    cardInclus: [
      'Thibilis — cité antique',
      'Grotte Ghar Djemaa',
      'Khanguet Lahdjar',
      'Nécropole de Roknia',
      'Tombes mégalithiques & dolmens',
    ],
    guideAvailability: 'Guide archéologie & préhistoire disponible',
    highlights: [
      'Thibilis — cité antique & vestiges romains',
      'Aquæ Thibilitanæ — vestiges antiques de Thibilis',
      'Grotte Ghar Djemaa',
      'Khanguet Lahdjar',
      'Nécropole de Roknia',
      'Tombes mégalithiques et dolmens',
      'Parcours préhistorique — route de la préhistoire',
    ],
    recommendedGuide: 'Guide archéologie & préhistoire recommandé',
    availableOptions: ['guide', 'photographer', 'premium_vehicle', 'traditional_lunch'],
    bookingMode: 'private',
  },
  {
    id: 'route-thermale-premium',
    title: 'Route Thermale Premium',
    circuitName: 'Route Thermale Premium',
    duration: 'Journée',
    identityBadge: '♨️ Bien-être & thermalisme',
    hook:
      'Une journée premium sur le circuit thermal officiel de Guelma : sources, oasis et bien-être de Debagh à El Baraka.',
    cardInclus: [
      'Hammam Debagh',
      'Hammam Chellala',
      'Bouchahrine',
      'El Baraka',
      'Piscines naturelles & panoramas',
    ],
    guideAvailability: 'Accompagnateur thermal disponible',
    highlights: [
      'Hammam Debagh — cascade & sources',
      'Hammam Chellala — station thermale',
      'Bouchahrine — sources et paysages',
      'El Baraka — détente & thermalisme',
      'Piscines naturelles du circuit thermal',
      'Journée bien-être privée PROTAXI',
    ],
    recommendedGuide: 'Accompagnateur thermal recommandé',
    availableOptions: [
      'spa_access',
      'traditional_lunch',
      'guide',
      'premium_vehicle',
      'photographer',
    ],
    bookingMode: 'private',
  },
];

export function getExperienceSiteCount(experience: ExperienceV1) {
  return experience.cardInclus.length;
}

export function getExperienceSiteBadgeLabel(experience: ExperienceV1) {
  const count = getExperienceSiteCount(experience);
  const plural = count > 1 ? 's' : '';
  return `📍 ${count} site${plural} inclus`;
}

/** Lieux affichés sur la carte étape 2 — max 3, liste verticale. */
export function getExperienceCardInclusPreview(
  experience: ExperienceV1,
  maxVisible = CARD_INCLUS_VISIBLE_MAX,
) {
  return experience.cardInclus.slice(0, maxVisible);
}

export function hasMoreExperiencePlaces(experience: ExperienceV1) {
  return experience.cardInclus.length > CARD_INCLUS_VISIBLE_MAX;
}

export function getExperienceV1(experienceId: string) {
  return EXPERIENCES_V1.find((item) => item.id === experienceId);
}

export function buildExperienceSteps(experience: ExperienceV1) {
  return [...PROTAXI_INCLUDES, ...experience.highlights].join(', ');
}

export function formatSelectedOptions(
  experience: ExperienceV1,
  selected: Partial<Record<ExperienceOptionId, boolean>>,
) {
  const chosen = experience.availableOptions
    .filter((id) => selected[id])
    .map((id) => EXPERIENCE_OPTION_CATALOG[id].label);

  return chosen.length > 0 ? chosen.join(', ') : 'Aucune option supplémentaire';
}

export function getBookingModeLabel(mode: ExperienceBookingMode) {
  return mode === 'group' ? GROUP_FORMULA_LABEL : PRIVATE_FORMULA_LABEL;
}

/** Vérifie l’intégrité du catalogue V1 (6 circuits, champs requis). */
export function validateExperiencesV1Catalog() {
  const errors: string[] = [];
  if (EXPERIENCES_V1.length !== 6) {
    errors.push(`Expected 6 experiences, got ${EXPERIENCES_V1.length}`);
  }
  const ids = new Set<string>();
  for (const item of EXPERIENCES_V1) {
    if (ids.has(item.id)) errors.push(`Duplicate id: ${item.id}`);
    ids.add(item.id);
    if (item.circuitName !== item.title) {
      errors.push(`circuitName must match title for ${item.id}`);
    }
    if (item.bookingMode !== 'private') {
      errors.push(`${item.id} must be private in V1`);
    }
    if (!item.identityBadge.trim()) {
      errors.push(`${item.id} needs identityBadge`);
    }
    if (!item.hook.trim()) {
      errors.push(`${item.id} needs hook`);
    }
    if (item.cardInclus.length < 1) {
      errors.push(`${item.id} needs cardInclus`);
    }
    if (!item.guideAvailability.trim()) {
      errors.push(`${item.id} needs guideAvailability`);
    }
    if (item.highlights.length < 1) {
      errors.push(`${item.id} needs highlights`);
    }
    if (item.availableOptions.length < 1) {
      errors.push(`${item.id} needs availableOptions`);
    }
  }
  return { ok: errors.length === 0, errors };
}
