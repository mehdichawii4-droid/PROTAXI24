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

const CARD_INCLUS_VISIBLE_MAX = 4;

/** Catalogue officiel lancement Guelma — expériences privées uniquement. */
export const EXPERIENCES_V1: ExperienceV1[] = [
  {
    id: 'hammam-debagh-signature',
    title: 'Hammam Debagh Signature',
    circuitName: 'Hammam Debagh Signature',
    duration: 'Demi-journée',
    hook: 'Découvrez l’un des sites naturels les plus spectaculaires d’Algérie.',
    cardInclus: [
      'Cascade de Hammam Debagh',
      'Cônes calcaires',
      'Sources thermales',
      'Point panoramique',
    ],
    guideAvailability: 'Guide local disponible',
    highlights: [
      'Cascade de Hammam Debagh',
      'Cônes calcaires',
      'Sources thermales',
      'Points photo',
    ],
    availableOptions: ['guide', 'photographer', 'traditional_lunch', 'premium_vehicle'],
    bookingMode: 'private',
  },
  {
    id: 'guelma-romaine',
    title: 'Guelma Romaine',
    circuitName: 'Guelma Romaine',
    duration: 'Demi-journée',
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
    hook: 'Revivez les moments qui ont marqué l’histoire contemporaine de la région.',
    cardInclus: [
      'Musée El Moudjahid',
      'Monument des Martyrs',
      'Maison Houari Boumediene',
      'Lieux du 8 mai 1945',
    ],
    guideAvailability: 'Guide historique disponible',
    highlights: [
      'Musée El Moudjahid',
      'Monument des Martyrs',
      'Maison Houari Boumediene',
      'Lieux liés au 8 mai 1945',
    ],
    recommendedGuide: 'Guide historique recommandé',
    availableOptions: ['guide', 'photographer', 'premium_vehicle', 'traditional_lunch'],
    bookingMode: 'private',
  },
  {
    id: 'traces-civilisations',
    title: 'Sur les Traces des Civilisations',
    circuitName: 'Sur les Traces des Civilisations',
    duration: 'Journée',
    hook: 'Des premiers peuples aux civilisations antiques, découvrez plusieurs millénaires d’histoire.',
    cardInclus: [
      'Thibilis',
      'Khanguet Lahdjar',
      'Tombes mégalithiques',
      'Sites archéologiques',
    ],
    guideAvailability: 'Guide archéologie disponible',
    highlights: ['Thibilis', 'Khanguet Lahdjar', 'Tombes mégalithiques'],
    recommendedGuide: 'Guide archéologique recommandé',
    availableOptions: ['guide', 'photographer', 'premium_vehicle', 'traditional_lunch'],
    bookingMode: 'private',
  },
  {
    id: 'route-thermale-premium',
    title: 'Route Thermale Premium',
    circuitName: 'Route Thermale Premium',
    duration: 'Journée',
    hook: 'Une journée de détente entre sources thermales, bien-être et patrimoine naturel.',
    cardInclus: ['Hammam Debagh', 'Hammam Chellala', 'Bouchahrine', 'El Baraka'],
    guideAvailability: 'Accompagnateur disponible',
    highlights: [
      'Hammam Debagh',
      'Hammam Chellala',
      'Bouchahrine',
      'El Baraka',
    ],
    availableOptions: ['spa_access', 'traditional_lunch', 'guide', 'premium_vehicle'],
    bookingMode: 'private',
  },
];

export function getExperienceSiteCount(experience: ExperienceV1) {
  return experience.cardInclus.length;
}

export function getExperienceSiteBadgeLabel(experience: ExperienceV1) {
  const count = getExperienceSiteCount(experience);
  const plural = count > 1 ? 's' : '';
  return `📍 ${count} site${plural} à découvrir`;
}

/** Puces carte étape 2 — max 4 visibles + overflow. */
export function formatExperienceCardInclusLine(
  experience: ExperienceV1,
  maxVisible = CARD_INCLUS_VISIBLE_MAX,
) {
  const items = experience.cardInclus;
  const visible = items.slice(0, maxVisible);
  const overflow = items.length - visible.length;
  const line = visible.map((label) => `• ${label}`).join('  ');
  if (overflow <= 0) return line;
  const otherWord = overflow > 1 ? 'autres étapes' : 'autre étape';
  return `${line}  + ${overflow} ${otherWord}`;
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
