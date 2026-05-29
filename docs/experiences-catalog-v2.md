# Catalogue Expériences PROTAXI — Documentation V2

**Statut :** validé produit — documentation uniquement  
**Date :** mai 2026  
**Périmètre :** stratégie catalogue et enrichissement progressif des 6 expériences premium V1  

---

## Décisions validées

| Décision | Détail |
|----------|--------|
| Conserver la V1 | 6 expériences premium, wizard 5 étapes, tarif « Sur confirmation » |
| Pas de 11 circuits en app | Aucune section « Circuits officiels de Guelma » séparée |
| Stratégie V2 | Adapter le contenu des circuits officiels **dans** les 6 SKU existants |
| Référence produit | **Circuit touristique El Guelmi** = modèle narratif et patrimonial principal |
| Hors scope V2 doc | Firestore, admin, `createTourBooking`, flow réservation, séjours 2 jours (phase ultérieure) |

---

## Principe directeur

Les circuits officiels de Guelma ne deviennent **pas** de nouvelles cartes réservables. Ils servent de **source patrimoniale** pour enrichir progressivement :

- `subtitle`, `highlights`, `recommendedGuide`
- copy écran (hero, étape 2, résumé) — quand implémentation autorisée
- fiches opérationnelles internes (arrêts, durée réelle, sensibilité religieux/historique)

**Invariant technique V1 (à ne pas casser) :**

- `id` stable par expérience (`hammam-debagh-signature`, etc.)
- `circuitName` = `title` (identité documents `tourBookings` existants)
- `source: experiences-private`
- 6 entrées dans `EXPERIENCES_V1`

Toute évolution V2 de contenu catalogue est **cosmétique / éditoriale** tant que `circuitName` et `id` ne changent pas.

---

## Référence produit : Circuit touristique El Guelmi

### Rôle

El Guelmi n’est pas un 7ᵉ produit. C’est la **grille de lecture** du patrimoine urbain et panoramique de Guelma, réutilisée pour :

1. **Positionner** la marque PROTAXI Expériences (« Guelma vue depuis la ville »).
2. **Enrichir** l’expérience premium la plus proche du centre-ville : **Guelma Romaine**.
3. **Harmoniser** le ton des 5 autres expériences (accroches, ordre des highlights, cohérence « officiel + premium »).

### Ce qu’apporte El Guelmi (contenu à intégrer, pas à publier tel quel)

- Parcours ville : points de vue, artères historiques, respiration entre sites.
- Lien naturel avec Calama / théâtre (complète *Guelma Romaine*, ne le remplace pas).
- Durée type : demi-journée — alignée V1.
- Message client : « Découvrir Guelma avant d’aller plus loin (thermal, Maouna, mémoire). »

### Règle de différenciation

| Couche | Promesse |
|--------|----------|
| Tracé officiel El Guelmi | Circuit classique, institutionnel, reproductible |
| Premium **Guelma Romaine** | Même territoire + **PROTAXI** (transport, chauffeur, conciergerie, options guide/photo/repas, flexibilité horaire) |

Le client réserve toujours **Guelma Romaine** ; le contenu El Guelmi **renforce** la crédibilité patrimoniale sans second choix concurrent.

---

## Les 6 expériences premium — ordre vitrine V1 (inchangé)

Ordre recommandé à conserver en tête de catalogue :

1. Hammam Debagh Signature  
2. Route Thermale Premium  
3. Guelma Romaine *(porte El Guelmi)*  
4. Mémoire de Guelma  
5. Sur les Traces des Civilisations  
6. Nature Maouna  

---

## Matrice d’adaptation : circuits officiels → 6 premium

Les 11 circuits officiels listés en exploration produit sont **absorbés** par correspondance éditoriale. Aucun n’apparaît comme entrée catalogue séparée.

| Circuit officiel (source) | Expérience premium cible | Type d’enrichissement V2 |
|---------------------------|--------------------------|---------------------------|
| **Circuit touristique El Guelmi** | **Guelma Romaine** + tonalité globale | **Référence principale** — highlights ville, accroche hero |
| Circuit de la ville archéologique Calama | Guelma Romaine | Arrêts Calama, jardin archéologique (déjà partiellement couverts) |
| Circuit romain Thibilis | Sur les Traces des Civilisations | Thibilis explicite, tombeaux, mégalithes |
| Circuit éco-touristique Maouna - Taya | Nature Maouna | Tracé forêt / Taya, pause Ain Sefra |
| Circuit mémoire 08 mai 1945 | Mémoire de Guelma | Lieux 8 mai, musée, martyrs (aligné V1) |
| Circuit touristique thermal | Hammam Debagh Signature + Route Thermale Premium | Debagh = signature ; Chellala / Baraka = route premium |
| Circuit religieux | Mémoire de Guelma *(secondaire)* | Mention sensible en note opérationnelle ; pas d’option « religieux » en V2 |
| Circuit Houara - Beni Salah | Nature Maouna | Extension optionnelle en highlights « sur demande » |
| Circuit batailles de la révolution | Mémoire de Guelma | Renfort guide historique, étapes batailles |
| Route de la préhistoire | Sur les Traces des Civilisations | Mégalithes / préhistoire en copy |
| Réserve naturelle de Beni Salah | Nature Maouna | Réserve en highlight ou variante longue journée |

### Chevauchements assumés

Quand un officiel et un premium couvrent le même territoire :

- **Un seul SKU réservable** (le premium).
- Copy : « Inspiré du circuit officiel [nom] — expérience privée PROTAXI ».
- Pas de renommage `circuitName` (compatibilité Firestore / historique).

---

## Plan d’enrichissement progressif (par vague)

### Vague 0 — Documentation (actuel)

- Ce document + fiches par expérience (section ci-dessous).
- Aucun code, aucun déploiement.

### Vague 1 — El Guelmi + Guelma Romaine

**Cible :** `guelma-romaine`  
**Fichier futur :** `constants/experiencesPrivateCatalog.ts` uniquement (+ copy UI `experiences-private`, visuel si besoin).

- Subtitle : ancrage ville + patrimoine romain.
- Highlights : fusion El Guelmi (ville) + Calama (archéo) sans dépasser 5–6 puces lisibles.
- `recommendedGuide` : conserver ou renforcer « Guide local ».
- Hero étape 2 : une phrase type « De El Guelmi au théâtre romain ».

### Vague 2 — Cluster thermal

**Cibles :** `hammam-debagh-signature`, `route-thermale-premium`  
- Aligner highlights avec circuit touristique thermal officiel.
- Debagh = demi-journée signature ; Route = journée multi-stations.

### Vague 3 — Mémoire & civilisations

**Cibles :** `memoire-de-guelma`, `traces-civilisations`  
- Mémoire : circuit 08 mai + batailles (contenu, pas nouveau titre).
- Traces : Thibilis + route préhistoire.

### Vague 4 — Nature & extensions

**Cible :** `nature-maouna`  
- Maouna-Taya + réserve Beni Salah + Houara en highlights graduels ou note « extension sur devis ».

---

## Fiches produit V2 (contenu cible — non implémenté)

### 1. Hammam Debagh Signature

- **Officiels absorbés :** thermal (segment Debagh).
- **El Guelmi :** non — renvoi vers Guelma Romaine pour la ville.
- **Enrichissement :** cascade, cônes, sources ; option spa cohérente.

### 2. Route Thermale Premium

- **Officiels absorbés :** circuit touristique thermal (Chellala, Bouchahrine, El Baraka).
- **Position :** journée complète après Debagh signature.

### 3. Guelma Romaine *(porte El Guelmi)*

- **Officiels absorbés :** **El Guelmi (priorité)**, Calama.
- **El Guelmi :** référence narrative #1 du catalogue.
- **Enrichissement :** parcours ville → théâtre → thermes ; guide local recommandé.

### 4. Mémoire de Guelma

- **Officiels absorbés :** mémoire 08 mai 1945, batailles révolution ; religieux en note ops seulement.
- **Guide :** historique recommandé (déjà V1).

### 5. Sur les Traces des Civilisations

- **Officiels absorbés :** Thibilis, route préhistoire.
- **Durée :** journée (inchangée).

### 6. Nature Maouna

- **Officiels absorbés :** éco Maouna-Taya, réserve Beni Salah, Houara-Beni Salah (extensions).
- **Options :** pique-nique, guide, photo (inchangées).

---

## Séjours 2 jours — report explicite

Exemples produit (Maouna-Taya 2j, Houara-Beni Salah 2j, Batailles 2j) restent **hors V2 catalogue app**.

Préparation métier uniquement :

- Packages = prolongation des premium **Nature Maouna** et **Mémoire de Guelma** côté devis manuel.
- Pas de sélecteur hôtel / restaurant tant que partenaires non contractualisés.
- Ne pas ajouter de tier `stay_2d` dans le code avant validation opérationnelle distincte.

---

## Modifications futures prévues — `experiencesPrivateCatalog.ts`

**Uniquement quand une vague est validée pour implémentation** — toujours sans toucher Firestore/admin/booking.

### Champs documentation (commentaires ou type étendu plus tard)

```ts
// Exemple de métadonnées V2 — NON CODER tant que vague non validée
type ExperienceV2Meta = {
  /** Référence brochure / tourisme — pas stockée Firestore */
  officialSourceRefs?: string[];
  /** Ex. "el-guelmi" pour guelma-romaine */
  primaryOfficialRef?: string;
  /** Vague d'enrichissement */
  contentWave?: 'wave-1' | 'wave-2' | 'wave-3' | 'wave-4';
};
```

### Ce qui pourra changer (par vague)

| Champ | Modifiable | Interdit V2 |
|-------|------------|-------------|
| `subtitle` | Oui | — |
| `highlights` | Oui | — |
| `recommendedGuide` | Oui | — |
| `availableOptions` | Oui (avec prudence UX) | — |
| `id` | Non | Identité app + analytics |
| `circuitName` / `title` | Non | Documents Firestore existants |
| `bookingMode` | Non (private V1) | — |
| Nouveau tableau `EXPERIENCES_OFFICIAL` | Non | Stratégie abandonnée |

### Fonctions catalogue

- `validateExperiencesV1Catalog()` : **reste sur 6 entrées** — ne pas élargir aux méta V2.
- `buildExperienceSteps()` : reflétera automatiquement les nouveaux `highlights` après enrichissement.
- Pas de nouvelle fonction de réservation.

### Fichiers UI liés (hors catalogue, même vague)

- `app/experiences-private.tsx` — copy étape 2 / slogans si El Guelmi.
- `constants/experienceVisuals.ts` — visuel Guelma Romaine si repositionnement ville.
- `assets/images/experiences/` — README existant.

**Ne pas modifier :** `createTourBooking.ts`, rules Firestore, `admin-dashboard`, `history` (sauf bugfix hors sujet).

---

## Checklist avant toute implémentation code

- [ ] Vague validée (1 à 4).
- [ ] `circuitName` et `id` inchangés.
- [ ] `validateExperiencesV1Catalog()` toujours OK (6 items).
- [ ] Test manuel : réservation → `experience-confirmed` → admin voit même `circuitName`.
- [ ] Pas de 7ᵉ carte ni section « circuits officiels ».
- [ ] Copy « inspiré du circuit officiel … » validée par équipe terrain / tourisme.

---

## Synthèse une phrase

**V2 = même 6 expériences premium, même réservation ; le patrimoine des circuits officiels — avec El Guelmi comme référence — enrichit le contenu catalogue sans nouvelle section ni changement backend.**
