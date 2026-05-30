# Hotel Partner — Phase 2

**Statut document :** Étape 0 — spécification (aucune implémentation)  
**Date :** 2026-05-27  
**Référence :** Guide System V1 + Guide Phase 2 (pattern de référence)

---

## 1. Périmètre Phase 2

### Objectif

Permettre à un **hôtel** de :

1. Créer son propre compte Firebase (email / mot de passe).
2. Compléter et gérer son profil dans l’espace partenaire PROTAXI.
3. Soumettre son dossier en **validation admin** (`pending_review`).
4. Accéder aux **réservations partenaire** (transferts, excursions, parcours `hotel`) une fois le compte **actif**.

### Inclus

| Domaine | Détail |
|---------|--------|
| Registre | Collection unique `partners/{uid}` avec `partnerId === auth.uid` |
| Rôle app | `partner` (inchangé) |
| Auto-inscription | Uniquement `partnerType === 'hotel'` |
| Cycle de vie | `status` : `draft`, `pending_review`, `active`, `suspended` |
| Espace guide-like | Inscription (`partner-register`), profil (`partner-profile`), dashboard enrichi |
| Admin | Validation / suspension dans `admin-partner-details` (+ liste `admin-partners`) |
| Migration | Compatibilité progressive avec `isActive` existant |

### Exclu (Phase 2)

- Nouvelle collection `hotelPartners` ou rôle dédié `hotel`.
- Auto-inscription **agence** / **transport** (création admin uniquement, comme aujourd’hui).
- Refonte des écrans client `hotel.tsx` / `hotel-summary.tsx` (hors denormalisation `partnerId` / `partnerName`).
- Facturation, commissions, profil public hôtel côté client.
- Modifications : assignation guide, `experiences-private`, `admin-guides`, `createTourBooking` client.
- Lot 10 QA automatisé (checklist manuelle documentée, pas de suite E2E imposée en Phase 2).

### Principes (alignés Guide Phase 2)

- Le client **ne lit pas** `partners/{uid}` pour afficher un hôtel ; les réservations portent `partnerId` / `partnerName` en snapshot.
- Les champs admin (`internalNotes`, `validatedAt`, `validatedBy`) ne sont **jamais** écrits par l’hôtel.
- L’inscription autonome crée le document avec `status: pending_review` (ou `draft` puis soumission — voir workflow).
- La **création de réservation** partenaire reste interdite tant que le compte n’est pas **actif** (règles + UI).

---

## 2. Schéma `partners/{uid}`

**Identifiant document :** `uid` Firebase Auth du partenaire.

### Champs existants (conservés)

| Champ | Type | Description |
|-------|------|-------------|
| `uid` | string | Égal à `partnerId` / `auth.uid` |
| `companyName` | string | Nom de l’établissement (hôtel) |
| `partnerType` | `'hotel' \| 'agency' \| 'transport'` | Type partenaire ; auto-inscription force `'hotel'` |
| `contactName` | string | Responsable / réception |
| `phone` | string | Téléphone principal |
| `email` | string | Email de connexion (normalisé minuscules) |
| `isActive` | boolean | **Legacy** — miroir pendant migration (voir §5) |
| `createdAt` | timestamp | Création |
| `updatedAt` | timestamp | Dernière MAJ |
| `isOnline` | boolean? | Présence (login/logout partenaire) |
| `expoPushToken` | string? | Push (optionnel) |
| `expoPushTokenUpdatedAt` | timestamp? | Push |
| `pushTokenRole` | string? | Push |

### Champs nouveaux (Phase 2)

| Champ | Type | Description |
|-------|------|-------------|
| `status` | `PartnerStatus` | Statut métier (voir §3) |
| `validatedAt` | timestamp? | Date validation admin → `active` |
| `validatedBy` | string? | `uid` admin validateur |
| `internalNotes` | string? | Notes admin uniquement |

### Champs optionnels métier hôtel (Lots formulaire — si validés en règles)

| Champ | Type | Description |
|-------|------|-------------|
| `address` | string? | Adresse établissement |
| `city` | string? | Ville |
| `postalCode` | string? | Code postal |
| `receptionPhone` | string? | Téléphone réception (si distinct de `phone`) |
| `website` | string? | Site web |

> Les champs optionnels peuvent être livrés en Lot 6 (formulaire) ou reportés en 2.1 si le périmètre minimal suffit (`companyName`, `contactName`, `phone`, `email`).

### Contraintes Firestore (cible Lots 1–2)

- Auto-création : `partnerType == 'hotel'`, `status == 'pending_review'` (ou `draft` selon choix Lot 7), pas de `validatedAt` / `validatedBy` / `internalNotes`.
- Auto-update : autorisé seulement si `status in ['draft', 'pending_review']` ; `status` ne peut pas passer à `active` ou `suspended` côté hôtel.
- Admin : peut faire toutes les transitions autorisées + champs admin.
- `uid` immuable ; `partnerId` sur réservations = `auth.uid`.

### Type TypeScript (cible)

```ts
type PartnerStatus = 'draft' | 'pending_review' | 'active' | 'suspended';
```

(Réutilisation du même enum que `GuideStatus` possible en alias, sans fusion des collections.)

---

## 3. Statuts

| Statut | Libellé UI (indicatif) | Connexion | Édition profil | Création réservation |
|--------|------------------------|-----------|----------------|----------------------|
| `draft` | Brouillon | Oui | Oui | Non |
| `pending_review` | En attente de validation | Oui | Oui | Non |
| `active` | Actif / certifié | Oui | Non (lecture seule) | Oui |
| `suspended` | Suspendu | Non | Non | Non |

### Transitions autorisées

| De → Vers | Acteur |
|-----------|--------|
| `draft` → `pending_review` | Hôtel (`submitMyPartnerForReview`) |
| `draft` → `pending_review` | Hôtel (inscription directe en `pending_review`, équivalent) |
| `pending_review` → `active` | Admin (validation) |
| `pending_review` → `suspended` | Admin |
| `active` → `suspended` | Admin |
| `suspended` → `active` | Admin (réactivation) |
| `*` → `draft` | Admin uniquement (optionnel, cas correction) |

Transitions **interdites** côté hôtel : vers `active`, `suspended`, ou modification de `validatedAt` / `validatedBy` / `internalNotes`.

### Session app (`ProtaxiUserProfile`)

- Ajout `partnerStatus?: PartnerStatus` lorsque `role === 'partner'`.
- `isApproved` dérivé pour compatibilité : `status === 'active'` (et en transition : fallback `isActive`, voir §5).

---

## 4. Workflow hôtel

```text
[partner-register]
    → Compte Auth + partners/{uid}
    → partnerType: hotel
    → status: pending_review (recommandé, aligné guide-register Lot 6)
    → isActive: false

[Connexion]
    → assertProfileCanLogin (draft | pending_review | active OK ; suspended KO)

[partner-dashboard]
    → Affiche nom, statut, contact, type
    → Si active : date validatedAt, CTA réservations
    → Si non active : message attente, pas de « Nouvelle réservation »

[partner-profile]
    → Édition si draft | pending_review
    → Lecture seule si active | suspended
    → Bouton « Envoyer en validation » si draft
    → Bandeau si déjà pending_review

[Admin admin-partner-details]
    → Valider → active + validatedAt + validatedBy + isActive: true
    → Suspendre → suspended + isActive: false

[Opérations]
    → partner-new-booking, hotel, tour-booking : partnerId = auth.uid
    → Règles : isPartnerActive() ⇔ status == active (et isActive cohérent)
```

### Parcours inscription (cible Lot 7)

1. **Étape compte** : nom établissement (`companyName`), email, mot de passe.  
2. **Étape profil** : `HotelPartnerProfileForm` (contact, téléphone, champs optionnels).  
3. **Soumission** : `registerHotelPartnerWithEmail` + `registerHotelPartnerProfile` → redirect `/partner-dashboard?registered=1`.

### Parcours profil (cible Lot 8)

- `fetchMyPartnerProfile` / `updateMyPartnerProfile` / `submitMyPartnerForReview` via `partnerSelfService` (miroir `guideSelfService`).

---

## 5. Compatibilité legacy `isActive`

### Problème actuel

- Le module partenaire V1 utilise **`isActive: boolean`** (Actif / Suspendu).
- Les règles Firestore utilisent **`isPartnerActive()`** basé sur `isActive != false`.
- `mapProfileData` fait : `isApproved: Boolean(data.isApproved ?? data.isActive ?? true)`.

Sans migration, un hôtel en `pending_review` avec `isActive: true` pourrait **créer des réservations** à tort.

### Règle de lecture (Lot 2 — normalize)

Tant que `status` est absent sur un document legacy :

| `isActive` | `status` déduit |
|------------|-----------------|
| `true` | `active` |
| `false` | `suspended` |
| absent | `active` (prudence : traiter comme actif si historique opérationnel) |

Dès que `status` est présent, **`status` fait foi** pour l’app et les nouvelles règles.

### Règle d’écriture (dual-write — Lots 3, 9)

| Événement | `status` | `isActive` |
|-----------|----------|------------|
| Inscription hôtel | `pending_review` | `false` |
| Admin valide | `active` | `true` |
| Admin suspend | `suspended` | `false` |
| Admin réactive | `active` | `true` |
| Hôtel en attente | `pending_review` | `false` |

**Objectif :** ne pas casser les règles ni l’admin V1 avant déploiement complet du Lot 1.

### Fin de vie `isActive` (post Phase 2)

- Phase 2.1+ : règles uniquement sur `status` ; `isActive` lecture seule puis suppression champ (hors scope Phase 2).

---

## 6. Stratégie de migration

### Prérequis

1. Inventaire `partners` (script audit existant ou dédié) : `uid`, `partnerType`, `isActive`, présence `status`, lien Auth.
2. Sauvegarde / export Firestore avant script prod.

### Script de migration (Lot 10)

Pour chaque document `partners/{id}` **sans** `status` :

| Condition | Action |
|-----------|--------|
| `isActive === true` | `status = 'active'`, `isActive = true` |
| `isActive === false` | `status = 'suspended'`, `isActive = false` |
| `isActive` absent | `status = 'active'`, `isActive = true` (partenaires historiques opérationnels) |

Backfill optionnel pour partenaires déjà actifs :

- `validatedAt` ← `updatedAt` ou `createdAt` si manquant.
- `validatedBy` ← `'migration'` (affichage dashboard uniquement).

**Ne pas modifier** : `partnerType` existant (agence / transport restent tels quels).

### Ordre de déploiement

```text
1. Lot 1  — Règles (isPartnerActive sur status + dual-write admin)
2. Lot 2  — Lecture tolérante status / isActive
3. Lots 3–9 — App + admin
4. Lot 10 — Script migration + vérif manuelle
5. Contrôle : partenaire legacy actif peut encore réserver ; nouvel hôtel pending ne peut pas
```

### Cas limites

| Cas | Traitement |
|-----|------------|
| Doc `partners` sans compte Auth | Inchangé ; admin gère ; pas d’auto-login |
| Auth sans doc `partners` | Inscription self crée le doc (comme guide) |
| Même `uid` dans `guides` et `partners` | Interdit produit ; résolution profil : `partners` prioritaire (`userService`) |
| Agence / transport | Pas d’inscription self ; migration statut seulement |

---

## 7. Roadmap — Lots 1 à 10

Ordre **strict** : ne pas démarrer le lot N+1 avant validation du lot N.

| Lot | Nom | Livrable | Fichiers principaux | Commit indicatif |
|-----|-----|----------|---------------------|------------------|
| **0** | Documentation | Ce document | `docs/hotel-partner-phase2.md` | `docs(partners): hotel partner phase 2 specification` |
| **1** | Règles Firestore | Self create/update hôtel ; validation champs ; `isPartnerActive` → `status == 'active'` ; deploy rules | `firestore.rules` | `firestore(rules): partner self-registration and status` |
| **2** | Types + core | `PartnerStatus`, `PartnerFormInput`, `PartnerSelfProfile`, validation, payload, transitions | `firebase/types.ts`, `types/partner.ts`, `services/partnerCoreService.ts`, `services/partnerService.ts` | `feat(partners): partner core service and status types` |
| **3** | Self service | `partnerSelfService` (register, fetch, update, submit) | `services/partnerSelfService.ts` | `feat(partners): add partnerSelfService` |
| **4** | Auth & session | `registerHotelPartnerWithEmail`, `mapPartnerToProtaxiProfile`, `partnerStatus`, login/session | `authService.ts`, `userService.ts`, `authUtils.ts`, `AuthContext.tsx`, `functions/src/index.ts` (si besoin) | `feat(auth): hotel partner registration and session` |
| **5** | Navigation | Routes `partner-register`, `partner-profile`, RouteGuard, lien login | `utils/navigation.ts`, `app/_layout.tsx`, `app/login.tsx` | `feat(navigation): hotel partner routes and guards` |
| **6** | Formulaire | `HotelPartnerProfileForm` + validation | `components/partner/`, `types/`, `utils/` | `feat(partners): reusable HotelPartnerProfileForm` |
| **7** | Inscription | Wizard `partner-register` | `app/partner-register.tsx` | `feat(partners): hotel registration wizard` |
| **8** | Dashboard & profil | Enrichir `partner-dashboard` ; `partner-profile` métier | `app/partner-dashboard.tsx`, `app/partner-profile.tsx`, utils affichage | `feat(partners): partner dashboard and profile screens` |
| **9** | Admin validation | Statuts dans admin liste + détail ; `validatePartner` / suspend ; dual-write | `admin-partner-details.tsx`, `admin-partners.tsx`, `adminPartnerService.ts` | `feat(admin): partner status validation workflow` |
| **10** | Migration & QA | Script migration ; checklist régression | `scripts/`, mise à jour ce doc (statut « déployé ») | `chore(partners): migrate partner status fields` |

**Estimation totale :** 9 à 11 commits (Lot 0 inclus).

### Dépendances entre lots

```text
0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10
         └──────────────────┘
              6 avant 7 (formulaire avant wizard)
```

### Checklist QA (Lot 10 — manuelle)

- [ ] Inscription hôtel → `pending_review`, `isActive: false`, login OK, pas de réservation.
- [ ] Admin valide → `active`, réservation `rides` / `tourBookings` OK, `partnerName` snapshot OK.
- [ ] Admin suspend → login refusé.
- [ ] Partenaire legacy migré : toujours actif et peut réserver.
- [ ] Agence / transport : pas de `partner-register` ; admin inchangé fonctionnel.
- [ ] Régression : guide, client, admin-guides, assignation guide, expériences-privées, `hotel.tsx` params.

---

## 8. Références code existant (V1)

| Élément | Emplacement |
|---------|-------------|
| Collection partenaires | `firestore.rules` → `match /partners/{partnerId}` |
| Profil normalisé | `services/partnerService.ts` |
| Admin liste / détail | `app/admin-partners.tsx`, `app/admin-partner-details.tsx`, `services/adminPartnerService.ts` |
| Dashboard partenaire | `app/partner-dashboard.tsx` |
| Réservations | `services/partnerBookingService.ts`, règles `isPartnerRideCreate` |
| Module hôtel (booking UI) | `app/hotel.tsx`, `app/hotel-summary.tsx`, `pickPartnerFieldsFromParams` |
| Routes partenaire | `services/authUtils.ts` → `PARTNER_ROUTES` |
| Pattern guide Phase 2 | `services/guideSelfService.ts`, `docs/guide-mvp-phase1.md`, lots guide 1–8 |

---

## 9. Historique du document

| Version | Date | Auteur | Changement |
|---------|------|--------|------------|
| 1.0 | 2026-05-27 | Étape 0 | Création initiale — spécification validée produit |
