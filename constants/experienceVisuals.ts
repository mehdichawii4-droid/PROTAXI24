import type { ImageSourcePropType } from 'react-native';

import type { ExperienceV1 } from '@/constants/experiencesPrivateCatalog';

/** Visuels officiels catalogue V1 — assets/images/experiences/ */
export const EXPERIENCE_VISUAL_SPECS: Record<
  string,
  { filename: string; description: string }
> = {
  'hammam-debagh-signature': {
    filename: 'hammam-debagh-signature.jpg',
    description: 'Cascade et cônes calcaires, Hammam Debagh',
  },
  'guelma-romaine': {
    filename: 'guelma-romaine.jpg',
    description: 'Ville archéologique de Calama — théâtre et jardin',
  },
  'nature-maouna': {
    filename: 'nature-maouna.jpg',
    description: 'Forêt Maouna et panoramas',
  },
  'memoire-de-guelma': {
    filename: 'memoire-de-guelma.jpg',
    description: 'Musée et mémoire collective',
  },
  'traces-civilisations': {
    filename: 'traces-civilisations.jpg',
    description: 'Thibilis et sites archéologiques',
  },
  'route-thermale-premium': {
    filename: 'route-thermale-premium.jpg',
    description: 'Circuit thermal Debagh–Chellala–El Baraka',
  },
};

const EXPERIENCE_IMAGES: Record<string, ImageSourcePropType> = {
  'hammam-debagh-signature': require('../assets/images/experiences/hammam-debagh-signature.jpg'),
  'guelma-romaine': require('../assets/images/experiences/guelma-romaine.jpg'),
  'nature-maouna': require('../assets/images/experiences/nature-maouna.jpg'),
  'memoire-de-guelma': require('../assets/images/experiences/memoire-de-guelma.jpg'),
  'traces-civilisations': require('../assets/images/experiences/traces-civilisations.jpg'),
  'route-thermale-premium': require('../assets/images/experiences/route-thermale-premium.jpg'),
};

export function getExperienceV1Image(experience: ExperienceV1): ImageSourcePropType {
  return EXPERIENCE_IMAGES[experience.id] ?? require('../assets/images/theatre-romain.jpg');
}
