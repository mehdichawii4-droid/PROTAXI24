# Visuels — Expériences privées PROTAXI (V1)

Catalogue branché dans `constants/experienceVisuals.ts`.

## Fichiers actifs (V1)

| Fichier | Expérience |
|---------|------------|
| `hammam-debagh-signature.jpg` | Hammam Debagh Signature |
| `guelma-romaine.jpg` | Guelma Romaine |
| `nature-maouna.jpg` | Nature Maouna |
| `memoire-de-guelma.jpg` | Mémoire de Guelma |
| `traces-civilisations.jpg` | Sur les Traces des Civilisations |
| `route-thermale-premium.jpg` | Route Thermale Premium |

Recommandation production : **1200×800**, JPG, < 500 Ko, photos réelles Guelma.

Pour remplacer une image : écraser le fichier (même nom) puis recharger Expo (`r`).

## QA

- `npm run validate:experiences` — catalogue 6 circuits
- `node scripts/qa-hammam-firestore-trace.mjs` — document Firestore attendu (Hammam)
