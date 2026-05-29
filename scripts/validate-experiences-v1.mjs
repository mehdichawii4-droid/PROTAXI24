/**
 * Vérifie le catalogue Expériences privées V1 (6 circuits).
 * Usage: node scripts/validate-experiences-v1.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalogPath = join(__dirname, '../constants/experiencesPrivateCatalog.ts');
const text = readFileSync(catalogPath, 'utf8');

const expectedIds = [
  'hammam-debagh-signature',
  'guelma-romaine',
  'nature-maouna',
  'memoire-de-guelma',
  'traces-civilisations',
  'route-thermale-premium',
];

const errors = [];
for (const id of expectedIds) {
  if (!text.includes(`id: '${id}'`)) {
    errors.push(`Missing experience id: ${id}`);
  }
}

const idMatches = text.match(/id: '[^']+'/g) ?? [];
const experienceIds = idMatches.filter((m) => expectedIds.some((e) => m.includes(e)));
if (experienceIds.length !== 6) {
  errors.push(`Expected 6 experience ids in catalog, found ${experienceIds.length}`);
}

if (text.includes('image: require')) {
  errors.push('Catalog should not embed image requires (use experienceVisuals.ts)');
}

if (errors.length) {
  console.error('validate-experiences-v1: FAILED');
  errors.forEach((e) => console.error(' -', e));
  process.exit(1);
}

console.log('validate-experiences-v1: OK — 6 official experiences present');
