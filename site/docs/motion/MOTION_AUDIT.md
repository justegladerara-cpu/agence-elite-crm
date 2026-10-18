# Audit du site vitrine avant le mouvement (Phase 0 et 1)

Référence : commit `5f45ba3` (fusion de la PR #14), branche de production `claude/project-thread-j6wx9s`.

## Ce qui publie www.agence-elite.fr (vérifié)

- Projet Cloudflare Pages **`agence-elite-crm`**, dépôt `justegladerara-cpu/agence-elite-crm`, branche de production `claude/project-thread-j6wx9s`.
- Générateur statique **`site/build.mjs`** (+ `site/data.mjs`, `site/assets/site.js`, `site/assets/site.css`, `site/legal/`), construit dans `dist/site` par `npm run build`.
- `functions/_middleware.js` sert `/site/*` à la racine de www et `/recrutement/*` depuis `public/recrutement/` (Elite Emploi, application séparée, non modifiée).
- Le dépôt `agenceelite` (Next.js) ne sert **pas** www : non modifié. L'application CRM (`src/`), les migrations Supabase, les fonctions et `public/recrutement` ne sont pas modifiés.

## Constats (fichier:ligne au commit 5f45ba3)

| # | Constat | Où | Gravité |
|---|---------|----|---------|
| 1 | Polices Google chargées par une feuille **bloquante** sur deux domaines tiers (fonts.googleapis.com + fonts.gstatic.com) : 2 connexions supplémentaires avant le premier affichage sur mobile | `site/build.mjs:113-115` | Haute (FCP/LCP mobile) |
| 2 | Apparitions : la classe `apparait` (opacité 0) est posée sur **tous** les blocs, y compris ceux déjà à l'écran : ils clignotent puis réapparaissent en fondu, et peuvent retarder le LCP | `site/assets/site.js:75-90`, `site.css:1776-1784` | Moyenne |
| 3 | Après apparition, `.js .apparait` (spécificité plus forte) **écrase les transitions de survol** des cartes : levée de carte en 0,6 s, ombre sans transition | `site.css:1779` vs `site.css:645` | Faible |
| 4 | Défilement infini des logos sans moyen de pause au clavier ou au toucher (pause au survol seulement) : non conforme WCAG 2.2.2 ; animation jamais suspendue hors écran | `site.css:530-534` | Moyenne (accessibilité) |
| 5 | `aria-label` sur un `div` sans rôle (ignoré par les lecteurs d'écran) | `site/build.mjs:208` | Faible |
| 6 | Images locales sans `width`/`height` (logos partenaires, illustrations, galerie, cartes sans photo) : décalages possibles au chargement | `site/build.mjs:197, 207, 430, 435, 557` | Faible (CLS mesuré 0,002-0,003) |
| 7 | Menu mobile : le focus n'entre pas dans le menu à l'ouverture et ne revient pas au bouton après Échap ; menu resté ouvert (défilement bloqué) si on repasse en grand écran | `site/assets/site.js:17-21, 57-60` | Moyenne (accessibilité) |
| 8 | Écouteur de défilement qui réécrit la classe de l'en-tête à chaque événement (passif, coût faible) | `site/assets/site.js:13` | Faible |
| 9 | Aucun jeton de mouvement : durées et courbes codées en dur (0,15 s à 0,6 s, `ease`) | `site.css` (≈ 20 transitions) | Faible (cohérence) |
| 10 | Liens actifs du menu signalés seulement par la couleur (pas d'`aria-current`) | `site/build.mjs:147-148` | Faible |
| 11 | Rouge texte `#e10600` (contraste 5,0:1, conforme AA) au lieu du `#fb0000` de la charte (4,1:1, non conforme pour du texte courant) | `site.css:3` | Choix conservé, voir stratégie |
| 12 | Photos Unsplash avec `srcset`/`sizes`, `loading="lazy"` et `fetchpriority="high"` sur l'image principale : correct | `site/build.mjs:17-21` | OK |
| 13 | Réduction des animations : règle globale `animation/transition: none` présente | `site.css:1785-1799` | OK |
| 14 | SEO : titre, description, canonique, Open Graph, JSON-LD `ProfessionalService`, sitemap, robots, un seul h1 par page, fil d'Ariane : corrects | `site/build.mjs:95-117, 793-795` | OK |
| 15 | Pas de CSS critique en ligne : `site.css` (46 Ko, 21,7 Ko compressé) bloque l'affichage ; les styles de la boutique sont chargés sur toutes les pages | `site/build.mjs:116` | Moyenne (feuille de route) |

## Animations existantes recensées

- Transitions de survol (boutons, cartes, liens fléchés, méga-menus 0,18 s, FAQ), zoom des photos de cartes (0,5 s).
- `@keyframes defile` (logos, 45 s, infini) et `toast-in` (boutique).
- Un seul `IntersectionObserver` pour les apparitions (bonne base, réutilisée).
- Pas de boucle `requestAnimationFrame`, pas de bibliothèque d'animation, pas de `will-change`.
