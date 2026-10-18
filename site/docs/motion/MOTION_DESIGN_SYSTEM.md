# Système de design du mouvement

Tous les jetons sont des propriétés personnalisées CSS sur `:root` (`site/assets/site.css`, en tête de fichier).

## Durées

| Jeton | Valeur | Usage |
|---|---|---|
| `--mo-instant` | 90 ms | appui (`:active`) |
| `--mo-rapide` | 160 ms | couleur, bordure, fond au survol |
| `--mo-base` | 240 ms | levée des cartes, soulignement du menu, FAQ, onglets |
| `--mo-lent` | 420 ms | fondus d'apparition, badges, menu mobile |
| `--mo-scene` | 720 ms (560 ms en équilibré) | entrée du héros, déplacement des apparitions |
| `--mo-decalage` | 70 ms (50 ms en équilibré) | cascade entre éléments frères (4 rangs au plus) |
| `--mo-distance` | 22 px (14 px en équilibré) | amplitude des montées |

## Courbes

| Jeton | Valeur | Usage |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | changements d'état |
| `--ease-enter` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | éléments qui arrivent (décélération marquée) |
| `--ease-exit` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | éléments qui partent |
| `--ease-emphasized` | `cubic-bezier(0.2, 1.3, 0.35, 1)` | petit rebond : boutons, badges, flèches |

## Images clés (`@keyframes`)

`ems-monte` (montée + fondu), `ems-glisse` (montée sans opacité, pour les images LCP), `ems-pop` (apparition avec léger rebond), `ems-flotte` (flottement des badges, alterné), `ems-tourne` (orbites, 90 s), `ems-brille` (reflet des boutons), `ems-souligne` (surlignage du titre), `ems-onde` (onde du bouton WhatsApp, 2 fois), `ems-secoue` (champ invalide), `ems-progres` (barre de lecture liée au défilement).

## Règles

- Montée + fondu pour ce qui entre ; jamais plus de 4 rangs de cascade (≤ 280 ms d'attente).
- Les animations continues sont décoratives, lentes (≥ 4,5 s) et suspendues hors écran / onglet masqué.
- Une animation ne doit jamais retarder la lecture : texte lisible avant 300 ms d'animation.
- Couleurs du mouvement : rouge vif `--rouge-vif` (#fb0000) pour le graphique, `--rouge` (#e10600) pour le texte.
- Ajouter une animation : utiliser les jetons, la placer sous `.mo` (ou `.mo-plein` si elle est continue ou liée au pointeur), vérifier qu'elle disparaît sous « réduire les animations » (règle globale en fin de bloc EMS).
