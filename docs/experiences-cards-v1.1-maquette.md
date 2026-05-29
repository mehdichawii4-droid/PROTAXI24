# Maquette UI — Cartes expériences (Vague 1.1)

**Statut :** proposition — **à valider avant code**  
**Périmètre :** étape 2 uniquement (`experiences-private.tsx` + données catalogue)  
**Hors scope :** flow, `createTourBooking`, Firestore, admin, history, navigation  

---

## 1. État actuel (étape 2)

```
┌─────────────────────────────────────────────────────────────┐
│  [thumb 64×64]  Titre (15px bold blanc)                     │
│                 Subtitle informatif (12px gris)             │
│                 Description longue? (11px gris) — Guelma    │
│                 Durée (11px vert)                           │
│                 Guide recommandé (10px or)                  │
└─────────────────────────────────────────────────────────────┘
```

**Problème :** ton catalogue / institutionnel, peu de projection voyage.

---

## 2. Maquette cible (même squelette visuel)

**Conservé :** `GlassCard`, ligne horizontale, vignette 64×64, radius 12, couleurs `#8BC53F` / `#D4A017` / `#8A8A8A`, pas de nouvelle image ni d’animation.

**Changé :** hiérarchie textuelle dans la colonne droite uniquement.

```
┌─────────────────────────────────────────────────────────────┐
│  [thumb]        Titre                                       │
│                 Accroche (1–2 phrases, 12px, #E8E8E8)       │
│                 📍 N sites à découvrir (11px vert)          │
│                 Inclus dans l’expérience (10px gris label)    │
│                 • Site 1  • Site 2  • Site 3  (+1)          │
│                 Demi-journée / Journée (11px vert)            │
│                 👨‍🏫 Guide … disponible (10px or)            │
└─────────────────────────────────────────────────────────────┘
```

### Règles anti-surcharge

| Règle | Valeur |
|-------|--------|
| Accroche | Max 2 lignes (`numberOfLines={2}`) |
| Puces « Inclus » | Max **4** visibles sur la carte ; si plus, ligne `+ N autres étapes` |
| Label section | « Inclus dans l’expérience » une seule fois, 10px uppercase léger |
| Badge sites | Dérivé automatiquement : `cardInclus.length` (pas de saisie manuelle) |
| Émojis | 📍 et 👨‍🏫 uniquement (cohérence iOS/Android) |
| Carte non sélectionnée | Même densité (pas de collapse) — lisibilité scroll |
| Carte sélectionnée | Bordure verte existante (`active`) — inchangée |

**Supprimé de la carte (étape 2) :** `subtitle` informatif + `description` longue type Vague 1 Calama (remplacés par accroche + inclus).

---

## 3. Modèle de données catalogue (proposition)

Ajouts dans `ExperienceV1` — **affichage étape 2 seulement** :

```ts
type ExperienceV1 = {
  // inchangés : id, title, circuitName, duration, highlights, availableOptions, bookingMode
  hook: string;              // accroche émotionnelle (1–2 phrases)
  cardInclus: string[];      // libellés courts carte (4–6 max)
  guideAvailability: string; // ex. "Guide patrimoine disponible"
};
```

| Champ | Rôle |
|-------|------|
| `highlights` | **Inchangé** — alimente `buildExperienceSteps()` → réservation / Firestore |
| `cardInclus` | Copy touristique carte ; peut différer légèrement des `highlights` |
| `hook` | Remplace `subtitle` + `description` à l’écran |
| `guideAvailability` | Remplace `recommendedGuide` à l’écran |

Fonction utilitaire (catalogue) :

```ts
export function getExperienceSiteCount(item: ExperienceV1) {
  return item.cardInclus.length;
}
```

Badge : `📍 ${n} site${n > 1 ? 's' : ''} à découvrir`

Guide : `👨‍🏫 ${guideAvailability}`

---

## 4. Copy validée — 6 expériences

### Hammam Debagh Signature

| Élément | Texte |
|---------|--------|
| **Accroche** | Découvrez l’un des sites naturels les plus spectaculaires d’Algérie. |
| **Inclus** | Cascade de Hammam Debagh · Cônes calcaires · Sources thermales · Point panoramique |
| **Badge** | 📍 4 sites à découvrir |
| **Guide** | 👨‍🏫 Guide local disponible |

### Guelma Romaine

| Élément | Texte |
|---------|--------|
| **Accroche** | Voyagez à travers plus de 2000 ans d’histoire au cœur de l’ancienne cité de Calama. |
| **Inclus** | Théâtre romain · Jardin archéologique · Thermes romains · Piscine romaine · Vestiges byzantins |
| **Badge** | 📍 5 sites à découvrir |
| **Guide** | 👨‍🏫 Guide patrimoine disponible |

### Nature Maouna

| Élément | Texte |
|---------|--------|
| **Accroche** | Explorez les hauteurs verdoyantes de Maouna et profitez des plus beaux panoramas de Guelma. |
| **Inclus** | Forêt Ain Safra · Djebel Maouna · Points panoramiques · Pause nature |
| **Badge** | 📍 4 sites à découvrir |
| **Guide** | 👨‍🏫 Guide local disponible |

### Mémoire de Guelma

| Élément | Texte |
|---------|--------|
| **Accroche** | Revivez les moments qui ont marqué l’histoire contemporaine de la région. |
| **Inclus** | Musée El Moudjahid · Monument des Martyrs · Maison Houari Boumediene · Lieux du 8 mai 1945 |
| **Badge** | 📍 4 sites à découvrir |
| **Guide** | 👨‍🏫 Guide historique disponible |

### Sur les Traces des Civilisations

| Élément | Texte |
|---------|--------|
| **Accroche** | Des premiers peuples aux civilisations antiques, découvrez plusieurs millénaires d’histoire. |
| **Inclus** | Thibilis · Khanguet Lahdjar · Tombes mégalithiques · Sites archéologiques |
| **Badge** | 📍 4 sites à découvrir |
| **Guide** | 👨‍🏫 Guide archéologie disponible |

### Route Thermale Premium

| Élément | Texte |
|---------|--------|
| **Accroche** | Une journée de détente entre sources thermales, bien-être et patrimoine naturel. |
| **Inclus** | Hammam Debagh · Hammam Chellala · Bouchahrine · El Baraka |
| **Badge** | 📍 4 sites à découvrir |
| **Guide** | 👨‍🏫 Accompagnateur disponible |

---

## 5. Styles proposés (ajouts minimaux)

| Style | Spec |
|-------|------|
| `skuHook` | 12px, `#E8E8E8`, lineHeight 17, max 2 lignes |
| `skuBadge` | 11px, vert `#8BC53F`, fontWeight 700, marginTop 4 |
| `skuInclusLabel` | 10px, `#8A8A8A`, letterSpacing 0.4, marginTop 6 |
| `skuInclusLine` | 10px, `#C8C8C8`, lineHeight 14 — puces `•` inline, pas de liste verticale longue |
| `skuGuide` | 10px, or `#D4A017` — remplace `skuReco` |

**Hauteur carte :** +20 à +32 px vs aujourd’hui — acceptable dans un scroll vertical (6 cartes).

---

## 6. Implémentation prévue (après GO)

| Fichier | Action |
|---------|--------|
| `constants/experiencesPrivateCatalog.ts` | `hook`, `cardInclus`, `guideAvailability` × 6 ; retirer `description` / `recommendedGuide` de l’affichage (champs dépréciés ou supprimés) |
| `app/experiences-private.tsx` | Rendu étape 2 selon maquette ; `getExperienceSiteCount` |
| **Ne pas toucher** | `buildExperienceSteps`, `createTourBooking`, étapes 3–5 |

---

## 7. Variante refusée (pour mémoire)

- Carte **dépliée** au tap avec tous les inclus → rejetée (complexifie le flow visuel).
- Deuxième colonne ou carousel → hors scope « conserver le design ».
- Prix / CTA sur carte → hors scope.

---

## 8. Checklist validation produit

- [ ] Ton émotionnel OK sur les 6 accroches  
- [ ] Libellés « Inclus » OK (orthographe Théâtre/Byzantins, Ain Safra)  
- [ ] 4 puces max + overflow acceptable  
- [ ] Emojis 📍 👨‍🏫 validés sur device cible  
- [ ] GO implémentation code  
