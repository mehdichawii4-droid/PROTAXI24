# Discover PROTAXI — V2

**Statut :** spécification validée — implémentation D0–D4  
**Date :** mai 2026  
**Périmètre :** vitrine tourisme client — hub Discover → expériences privées officielles  

---

## Décisions validées

| Décision | Détail |
|----------|--------|
| Source unique circuits | `EXPERIENCES_V1` (`constants/experiencesPrivateCatalog.ts`) — 6 SKU |
| Redirect circuits | Toute sélection circuit Discover → `/experiences-private` |
| Fusion sections | « À la une » + « Circuits Signature » → **Expériences à la une** |
| Pas de nouveau SKU | Aucun 7ᵉ circuit réservable |
| Flow booking inchangé | `createTourBooking`, `source: experiences-private`, Guide V1, Hotel V1 |
| Tendances V2.0 | Best-seller **éditorial** (pas analytics client Firestore) |
| Hôtels / guides / photo V2.0 | Teasers + CTA vers flows existants ; données réelles en V2.1+ |

---

## Architecture

```text
app/index.tsx
    → discover-guelma.tsx (hub V2)
        → experiences-private.tsx (wizard 5 étapes, deep link experienceId)
        → hotel.tsx (transfert hôtel, inchangé)

Legacy (conservé, non promu) :
    discover-booking.tsx → tour-booking.tsx (source discover-guelma)
```

---

## Sections écran Discover V2

| Ordre | Section | Source données | Action |
|-------|---------|----------------|--------|
| 1 | Hero | Static copy | CTA → experiences-private |
| 2 | Expériences à la une | `getDiscoverFeaturedExperiences()` | Carousel → experiences-private |
| 3 | Populaires | `getDiscoverPopularExperiences()` | Row → experiences-private |
| 4 | Recommandé pour vous | `getDiscoverRecommendations()` | Liste éditoriale |
| 5 | Tendances PROTAXI | `getDiscoverTrendsHighlight()` | 1 carte best-seller éditorial |
| 6 | Hôtels partenaires | `getDiscoverHotelTeasers()` | Teaser → hotel.tsx |
| 7 | Guides certifiés | `getDiscoverGuideTeaser()` | Teaser → experiences-private (+ option guide) |
| 8 | Photographe | `getDiscoverPhotographerTeaser()` | Teaser → experiences-private (preselect) |
| 9 | Pourquoi PROTAXI | Static | — |
| 10 | Taxi ville | Lien city | city.tsx |

---

## Deep links `experiences-private`

| Param | Rôle |
|-------|------|
| `experienceId` | Pré-sélection SKU ; saute étape 1→2 avec expérience choisie |
| `source` | Traçabilité (`discover-v2`, `discover-v2-featured`, …) |
| `preselectOption` | `guide` \| `photographer` — options étape 4 |

---

## Mapping legacy Discover → SKU officiel

| Ancien libellé Discover V1 | `experienceId` |
|----------------------------|----------------|
| Hammam Debagh | `hammam-debagh-signature` |
| Théâtre romain / Guelma Antique | `guelma-romaine` |
| Maouna / Nature & Sources | `nature-maouna` |
| Mémoire / 8 mai | `memoire-de-guelma` |
| Thibilis / Civilisations | `traces-civilisations` |
| Route thermale | `route-thermale-premium` |

---

## Lots implémentés (D0–D4)

| Lot | Livrable |
|-----|----------|
| D0 | Ce document |
| D1 | `types/discover.ts`, `constants/discoverCatalogV2.ts`, `services/discoverCatalogService.ts` |
| D2 | `components/discover/*` |
| D3 | `app/discover-guelma.tsx` refactor |
| D4 | `utils/navigation.ts`, deep link `experiences-private.tsx` |

---

## Hors scope D0–D4

- Suppression `discover-booking.tsx`
- Analytics Firestore public (V2.1)
- Liste hôtels `partners` live (V2.1)
- Choix guide client / marketplace
- Modification `createTourBooking` / règles Firestore

---

## QA Discover V2.0

- [ ] Featured → wizard étape 2 avec bon `experienceId`
- [ ] Populaires / recommandations → 6 SKU uniquement
- [ ] Teaser guide → wizard avec option guide disponible
- [ ] Teaser photographe → option photographe précochée si `preselectOption`
- [ ] Hero CTA → experiences-private
- [ ] Hôtel teaser → hotel.tsx
- [ ] Booking final `source: experiences-private` + Guide System OK
- [ ] Legacy discover-booking encore accessible par URL directe

---

## Historique

| Version | Date | Changement |
|---------|------|------------|
| 1.0 | 2026-05-30 | Spécification Discover V2 — D0 |
