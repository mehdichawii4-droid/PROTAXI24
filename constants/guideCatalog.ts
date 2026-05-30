import type {
  GuideExperienceId,
  GuideSpecialty,
  GuideStatus,
  GuideYearsExperience,
} from '@/firebase/types';

export const GUIDE_STATUSES: readonly GuideStatus[] = [
  'draft',
  'pending_review',
  'active',
  'suspended',
] as const;

export const GUIDE_STATUS_LABELS: Record<GuideStatus, string> = {
  draft: 'Brouillon',
  pending_review: 'En attente de validation',
  active: 'Actif',
  suspended: 'Suspendu',
};

export const GUIDE_SPECIALTY_DEFS: readonly {
  id: GuideSpecialty;
  label: string;
}[] = [
  { id: 'patrimoine', label: 'Patrimoine' },
  { id: 'histoire', label: 'Histoire' },
  { id: 'archéologie', label: 'Archéologie' },
  { id: 'nature', label: 'Nature' },
  { id: 'thermal', label: 'Thermalisme' },
  { id: 'culture_artisanat', label: 'Culture & artisanat' },
] as const;

export const GUIDE_SPECIALTY_IDS: readonly GuideSpecialty[] = GUIDE_SPECIALTY_DEFS.map(
  (item) => item.id,
);

export const GUIDE_YEARS_EXPERIENCE_OPTIONS: readonly {
  id: GuideYearsExperience;
  label: string;
}[] = [
  { id: '1-3', label: '1 à 3 ans' },
  { id: '4-10', label: '4 à 10 ans' },
  { id: '10+', label: '10 ans et plus' },
] as const;

/** Ids stables du catalogue Expériences privées (6 SKU) — alignés sur guide-mvp-phase1.md */
export const GUIDE_EXPERIENCE_IDS: readonly GuideExperienceId[] = [
  'guelma-romaine',
  'memoire-de-guelma',
  'traces-civilisations',
  'nature-maouna',
  'hammam-debagh-signature',
  'route-thermale-premium',
] as const;

/** Titres `circuitName` / `experience` sur tourBookings → id catalogue. */
export const CIRCUIT_NAME_TO_EXPERIENCE_ID: Record<string, GuideExperienceId> = {
  'Guelma Romaine': 'guelma-romaine',
  'Mémoire de Guelma': 'memoire-de-guelma',
  'Sur les Traces des Civilisations': 'traces-civilisations',
  'Nature Maouna': 'nature-maouna',
  'Hammam Debagh Signature': 'hammam-debagh-signature',
  'Route Thermale Premium': 'route-thermale-premium',
};

const GUIDE_SPECIALTY_SET = new Set<string>(GUIDE_SPECIALTY_IDS);
const GUIDE_EXPERIENCE_ID_SET = new Set<string>(GUIDE_EXPERIENCE_IDS);
const GUIDE_STATUS_SET = new Set<string>(GUIDE_STATUSES);

export function isGuideSpecialty(value: string): value is GuideSpecialty {
  return GUIDE_SPECIALTY_SET.has(value);
}

export function isGuideExperienceId(value: string): value is GuideExperienceId {
  return GUIDE_EXPERIENCE_ID_SET.has(value);
}

export function isGuideStatus(value: string): value is GuideStatus {
  return GUIDE_STATUS_SET.has(value);
}

export function getGuideSpecialtyLabel(id: GuideSpecialty): string {
  return GUIDE_SPECIALTY_DEFS.find((item) => item.id === id)?.label ?? id;
}
