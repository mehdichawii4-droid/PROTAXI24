# Maquette UI — Badges d'identité expériences (Vague 2.5)

**Statut :** proposition — **à valider avant code**  
**Périmètre :** étape 2 uniquement · `experiencesPrivateCatalog.ts` + `experiences-private.tsx`  
**Hors scope :** flow, Firestore, réservation, admin, étapes 3–5  

---

## 1. Objectif

Un **badge d'identité** sous le titre répond en une seconde à : *« C'est quoi cette expérience ? »*  
Complémentaire au badge **📍 X sites** (déjà présent), qui répond à : *« Combien de lieux ? »*

---

## 2. Hiérarchie carte (étape 2) — après Vague 2.5

```
┌──────────────────────────────────────────────────────────────┐
│ [thumb 64×64]   Hammam Debagh Signature          (titre)   │
│                 ┌─────────────────────────────┐              │
│                 │ 🔥 Expérience la plus       │  ← NOUVEAU   │
│                 │    populaire                │    (pill)    │
│                 └─────────────────────────────┘              │
│                 Admirez Guelma depuis El Guelmi…  (hook)     │
│                 📍 5 sites à découvrir            (sites)    │
│                 INCLUS DANS L'EXPÉRIENCE                     │
│                 • Belvédère El Guelmi • …                    │
│                 Demi-journée                                   │
│                 👨‍🏫 Guide nature & patrimoine disponible      │
└──────────────────────────────────────────────────────────────┘
```

**Ordre vertical (colonne droite) :**

1. `title`  
2. **`identityBadge`** (pill) — **nouveau**  
3. `hook`  
4. `📍 N sites` (inchangé, texte simple vert)  
5. Inclus + durée + guide  

---

## 3. Copy validée — 6 expériences

| `id` | Badge d'identité |
|------|------------------|
| `hammam-debagh-signature` | 🔥 Expérience la plus populaire |
| `guelma-romaine` | 🏛️ Incontournable patrimoine |
| `nature-maouna` | 🌿 Nature & panoramas |
| `memoire-de-guelma` | 🇩🇿 Mémoire nationale |
| `traces-civilisations` | 🏺 Archéologie & civilisations |
| `route-thermale-premium` | ♨️ Bien-être & thermalisme |

---

## 4. Modèle catalogue (implémentation future)

```ts
type ExperienceV1 = {
  // … champs existants
  /** Badge d'identité — carte étape 2 uniquement */
  identityBadge: string;
};
```

Pas de variant Firestore · pas de nouveau param route.

---

## 5. Rendu visuel — pill PROTAXI

Réutiliser la grammaire du badge **« Bientôt »** (`soonBadge` étape 1) : petit pill, 10px, font 800.

### Style de base (recommandé — une famille, accents légers)

| Propriété | Valeur |
|-----------|--------|
| `borderRadius` | 8 (pill) |
| `paddingHorizontal` | 8 |
| `paddingVertical` | 3 |
| `fontSize` | 10 |
| `fontWeight` | 800 |
| `alignSelf` | `flex-start` |
| `marginTop` | 4 (sous le titre) |
| `marginBottom` | 0 |

### Variantes couleur (thème noir / vert / or)

| Variante | `backgroundColor` | `borderColor` | `color` texte | Usage |
|----------|-------------------|---------------|---------------|--------|
| **gold** (défaut) | `rgba(212,160,23,0.15)` | `rgba(212,160,23,0.35)` | `#D4A017` | Hammam, Guelma, Traces, Route |
| **green** | `rgba(139,197,63,0.12)` | `rgba(139,197,63,0.35)` | `#8BC53F` | Nature Maouna |
| **neutral** | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.12)` | `#E8E8E8` | Mémoire (🇩🇿 — lisible sans surcharger) |

**Recommandation produit :** Hammam en **gold renforcé** (bordure 0.5) pour « populaire » ; les 5 autres selon tableau ci-dessus.

### Renommage style interne (éviter confusion au code)

| Actuel | Futur |
|--------|--------|
| `styles.skuBadge` (texte 📍 sites) | `styles.skuSiteCount` |
| — | `styles.skuIdentityPill` + `styles.skuIdentityText` |

---

## 6. Maquettes ASCII par expérience

### Hammam Debagh Signature (gold renforcé)

```
Hammam Debagh Signature
[ 🔥 Expérience la plus populaire ]
Admirez Guelma depuis El Guelmi…
📍 5 sites à découvrir
```

### Guelma Romaine (gold)

```
Guelma Romaine
[ 🏛️ Incontournable patrimoine ]
Voyagez à travers plus de 2000 ans…
📍 5 sites à découvrir
```

### Nature Maouna (green)

```
Nature Maouna
[ 🌿 Nature & panoramas ]
Explorez les hauteurs verdoyantes…
📍 4 sites à découvrir
```

### Mémoire de Guelma (neutral)

```
Mémoire de Guelma
[ 🇩🇿 Mémoire nationale ]
Revivez les moments qui ont marqué…
📍 4 sites à découvrir
```

### Sur les Traces des Civilisations (gold)

```
Sur les Traces des Civilisations
[ 🏺 Archéologie & civilisations ]
Des premiers peuples aux civilisations…
📍 4 sites à découvrir
```

### Route Thermale Premium (gold)

```
Route Thermale Premium
[ ♨️ Bien-être & thermalisme ]
Une journée premium sur le circuit thermal…
📍 5 sites à découvrir
```

---

## 7. Garde-fous UX

| Règle | Détail |
|-------|--------|
| Une seule pill identité | Pas de double badge marketing |
| Pas de pill sur étapes 3–5 | Identité = choix catalogue seulement |
| Titre long | Pill en `flex-start`, pas étirée sur toute la largeur |
| Carte active | Pill inchangée (bordure verte = carte entière) |
| Emojis | Conserver ceux validés ; 🏛️ avec sélecteur unicode |

---

## 8. Implémentation prévue (après GO)

**`experiencesPrivateCatalog.ts`**

- Ajouter `identityBadge: string` sur les 6 entrées (tableau section 3).

**`experiences-private.tsx`**

- Sous `{item.title}` :

```tsx
<View style={[styles.skuIdentityPill, identityPillVariant(item.id)]}>
  <Text style={styles.skuIdentityText}>{item.identityBadge}</Text>
</View>
```

- Helper local `identityPillVariant(id)` → styles gold | green | neutral.
- Renommer `skuBadge` → `skuSiteCount` pour le libellé 📍.

**Fichiers non touchés :** tout le reste.

---

## 9. Checklist validation

- [ ] 6 libellés OK (ton premium, pas « circuit officiel »)
- [ ] Hammam = seule carte « populaire » (pas de doublon sur autres SKU)
- [ ] Contraste pill sur fond glass (device réel)
- [ ] Densité carte acceptable (6 cartes scroll)
- [ ] GO implémentation
