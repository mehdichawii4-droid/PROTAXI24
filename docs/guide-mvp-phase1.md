# Guide PROTAXI — MVP Phase 1

**Statut :** validé produit — documentation versionnée (étape 0)  
**Date :** mai 2026  
**Prérequis :** catalogue Expériences privées terminé · partenaires hôtels en place  

---

## Objectif

Mettre en place le **premier périmètre Guide PROTAXI** : un registre de guides certifiés, validés par l’admin, assignables **manuellement** aux réservations **Expériences privées** lorsque le client a demandé l’option guide.

**Résultat attendu Phase 1 :**

- PROTAXI sait **qui** sont ses guides et sur **quelles expériences** ils peuvent intervenir.
- L’admin peut **assigner un guide nommé** à une réservation `experiences-private` avec option guide.
- Le client n’choisit pas de guide ; la promesse reste *« guide confirmé par PROTAXI avant le départ »*.

---

## Périmètre

### Inclus (Phase 1)

| Domaine | Détail |
|---------|--------|
| Collection Firestore | `guides/{guideId}` |
| Extension | `tourBookings` (champs guide) |
| Rôle métier | Registre guide + validation admin |
| Assignation | Manuelle sur fiche réservation tourisme (admin) |
| Détection demande | `guideRequested` à la création si option guide cochée |
| Module admin | Liste guides + fiche + assignation sur réservation |
| Spécialités | 6 tags officiels dont **culture_artisanat** |

### Exclu (Phase 1)

| Hors scope | Report |
|------------|--------|
| Marketplace guides | — |
| Choix du guide par le client | Phase 2 |
| App / login guide | Phase 2 (ops + admin suffisent en P1) |
| Calendrier, disponibilités | Phase 2 |
| Paiement / revenus guide | Phase 2–3 |
| Circuits co-créés par guide | Phase 3+ |
| Fusion `tourGroups.assignedGuide` (texte legacy) | Phase 2 |

### Fichiers / systèmes non modifiés à l’étape 0

- Aucun code à cette étape.
- Catalogue `EXPERIENCES_V1` inchangé (ids et `circuitName` stables).
- Flow client 5 étapes inchangé.
- `createTourBooking`, rules, admin : documentés pour les **étapes 1–7** uniquement.

---

## Statuts du guide

| Statut | Signification | Assignable sur réservation ? |
|--------|---------------|------------------------------|
| `draft` | Fiche incomplète (brouillon admin) | Non |
| `pending_review` | En attente de validation admin | Non |
| `active` | Guide certifié PROTAXI | **Oui** |
| `suspended` | Retrait temporaire ou définitif | Non |

**Transitions :**

```text
draft → pending_review → active
                      ↘ suspended
active ↔ suspended (réactivation après contrôle admin)
```

**Règle :** aucun passage en `active` sans action admin explicite (anti faux guide).

---

## Structure Firestore — `guides/{guideId}`

**Recommandation :** `guideId === auth.uid` (aligné sur le modèle `partners/{uid}`).

| Champ | Type | Obligatoire | Notes |
|-------|------|-------------|--------|
| `uid` | string | Oui | = document id |
| `displayName` | string | Oui | Nom affiché client / admin |
| `phone` | string | Oui | Contact ops |
| `email` | string | Oui | Contact ops |
| `bio` | string | Oui | 50–300 caractères |
| `languages` | string[] | Oui | ≥ 1 (ex. `fr`, `ar`, `en`) |
| `specialties` | string[] | Oui | 1 à 3 — voir § Spécialités |
| `yearsExperience` | string | Oui | `1-3` \| `4-10` \| `10+` |
| `allowedExperienceIds` | string[] | Oui | Ids catalogue — voir § Matrice |
| `status` | string | Oui | Voir § Statuts |
| `photoUrl` | string | Non | Recommandé, pas bloquant P1 |
| `validatedAt` | Timestamp | Non | Renseigné à la validation |
| `validatedBy` | string | Non | uid admin |
| `internalNotes` | string | Non | Admin uniquement |
| `createdAt` | Timestamp | Oui | |
| `updatedAt` | Timestamp | Oui | |

**Hors document P1 :** tarifs, IBAN, KYC documents, note moyenne, calendrier.

---

## Extension `tourBookings`

Champs **additionnels** sur les documents existants (pas de nouvelle collection).

| Champ | Type | Rôle |
|-------|------|------|
| `guideRequested` | boolean | `true` si le client a coché l’option guide à la création |
| `assignedGuideId` | string \| null | Référence `guides/{guideId}` |
| `assignedGuideName` | string \| null | Snapshot affichage (nom au moment de l’assignation) |
| `guideAssignedAt` | Timestamp \| null | Traçabilité |
| `guideAssignedBy` | string \| null | uid admin ayant assigné |

### Règles métier

1. Assignation **uniquement** si `guideRequested === true`.
2. Guide cible : `status === active'`.
3. `allowedExperienceIds` du guide doit contenir l’expérience de la réservation (via mapping `circuitName` → id catalogue).
4. **Une réservation → un guide** maximum en Phase 1.
5. Réassignation possible par l’admin (historique détaillé = Phase 2).

### Détection `guideRequested`

À l’implémentation (étape 2) : dans `createTourBooking`, dériver `guideRequested` si le champ `options` contient le libellé de l’option catalogue `guide` (ex. « Guide local », « Guide patrimoine », etc.).

### Affichage client (optionnel — étape 6)

- `experience-confirmed` / `history` : si `assignedGuideName` présent → « Guide confirmé : [Nom] ».
- Sinon : message actuel (confirmation par PROTAXI).

**Séparation legacy :** ne pas confondre avec `tourGroups.assignedGuide` (string sur groupes) ; chemin dédié expériences privées.

---

## Spécialités officielles

Tags autorisés sur le profil guide (**1 à 3** par guide) :

| Id spécialité | Libellé affiché |
|---------------|-----------------|
| `patrimoine` | Patrimoine |
| `histoire` | Histoire |
| `archéologie` | Archéologie |
| `nature` | Nature |
| `thermal` | Thermalisme |
| `culture_artisanat` | Culture & artisanat |

**Note :** `culture_artisanat` couvre notamment Maison de l’Artisanat, métiers locaux et expériences culturelles liées au territoire (ex. futur Grand Tour, segments ville).

---

## Matrice expériences ↔ spécialités

### Catalogue actuel (`allowedExperienceIds`)

| `id` | Titre (`circuitName`) | Spécialités primaires | Spécialités secondaires |
|------|------------------------|------------------------|-------------------------|
| `guelma-romaine` | Guelma Romaine | `patrimoine` | `culture_artisanat`, `histoire` |
| `memoire-de-guelma` | Mémoire de Guelma | `histoire` | `patrimoine` |
| `traces-civilisations` | Sur les Traces des Civilisations | `archéologie` | `patrimoine` |
| `nature-maouna` | Nature Maouna | `nature` | `culture_artisanat` |
| `hammam-debagh-signature` | Hammam Debagh Signature | `nature`, `thermal` | `patrimoine` |
| `route-thermale-premium` | Route Thermale Premium | `thermal` | `nature` |

### Règle admin à la validation

- L’admin coche les **`allowedExperienceIds`** (multi-select des 6 expériences).
- Les spécialités servent au **filtrage** et à la cohérence métier ; la liste déroulante d’assignation filtre sur **`allowedExperienceIds`**, pas sur les seuls tags.

### Mapping `circuitName` → `experienceId`

À implémenter côté admin (étape 5) : table de correspondance titre catalogue ↔ id stable (les 6 titres = `circuitName`).

---

## Interface admin minimale

### A. Module « Guides » (nouvelle entrée)

| Écran | Fonctions |
|-------|-----------|
| **Liste** | Filtres `pending_review` \| `active` \| `suspended` ; colonnes nom, téléphone, spécialités, nb expériences |
| **Création** | Formulaire champs obligatoires ; statut initial `pending_review` |
| **Fiche** | Édition, **Valider** → `active`, **Suspendre**, notes internes, multi-select `allowedExperienceIds` |

**Accès :** depuis `admin-dashboard` (lien ou onglet « Guides »), même esprit que `/admin-partners`.

### B. Extension « Réservations tourisme » (existant)

Sur carte réservation lorsque :

- `source === 'experiences-private'`
- **et** `guideRequested === true`

| UI | Comportement |
|----|--------------|
| Badge | « Guide demandé » |
| Sélecteur | Guides `active` dont `allowedExperienceIds` inclut l’expérience |
| Action | « Assigner le guide » → écrit les champs `assignedGuide*` |
| État | « Aucun guide assigné » si vide |

### C. Côté client (inchangé P1)

- Pas de liste de guides.
- Copy existant : guide confirmé par PROTAXI.

---

## Roadmap implémentation — étapes 1 à 7

| Étape | Lot | Livrable |
|-------|-----|----------|
| **0** | Documentation | **`docs/guide-mvp-phase1.md`** (ce document) |
| **1** | Data | `firestore.rules`, `firebase/types.ts` — collection `guides`, champs `tourBookings`, rôle `guide` |
| **2** | Booking | `createTourBooking.ts` — `guideRequested` si option guide |
| **3** | Services | `guideService.ts`, `adminGuideService.ts` — CRUD, listes filtrées |
| **4** | Admin UI | Liste + fiche + validation guides |
| **5** | Admin assign | `TourBookingCard` / section tourisme — sélecteur + assignation |
| **6** | Client read *(optionnel)* | `experience-confirmed`, `history` — nom guide assigné |
| **7** | QA | Checklist : résa avec guide → assignation → confirmation admin |

**Ordre obligatoire :** 1 → 2 → 3 → 4 → 5 → (6) → 7.

**Hors sprint P1 :** app guide, choix client, paiements, calendrier.

---

## Phase 2 (rappel — hors P1)

- Choix guide côté client (2–3 profils).
- Login guide + missions.
- Disponibilités / conflits.
- Notes liées au `guideId`.
- Rémunération et tableau de bord revenus.

---

## Synthèse

| Décision | Phase 1 |
|----------|---------|
| Profil | `guides` + validation admin |
| Client | Ne choisit pas le guide |
| Lien réservation | `guideRequested` + `assignedGuideId` sur `tourBookings` |
| Spécialités | 6 dont **culture_artisanat** |
| Admin | Module Guides + assignation manuelle |
| Code | Étapes 1–7 après validation de ce document |
