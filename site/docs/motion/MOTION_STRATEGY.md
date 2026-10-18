# Stratégie de mouvement (Elite Motion System, site public)

## Objectif

Un site qui paraît **vivant et haut de gamme** dès la première seconde, sans rien sacrifier à la lecture, au référencement, à l'accessibilité ni à la vitesse sur un téléphone d'entrée de gamme en 3G à Pointe-Noire.

## Principes

1. **Amélioration progressive.** Le HTML livré contient tout le contenu, visible. Aucun état « invisible au départ » n'existe sans la classe `html.mo` (posée avant le premier affichage par un script de tête de 0,7 Ko) ou sans une classe posée par `motion.js`. Sans JavaScript : site complet et statique.
2. **Rien ne disparaît sous les yeux.** Les apparitions ne concernent que les blocs **sous le pli** au chargement.
3. **Le titre se lit tout de suite.** Entrée du héros en CSS pur, démarrée à la première image ; les images candidates au LCP bougent sans changer d'opacité.
4. **Composé, pas peint.** Ce qui bouge en continu n'anime que `transform`/`opacity` ; rien d'infini ne tourne hors écran ou onglet masqué ; aucune boucle `requestAnimationFrame` permanente ; pas de `will-change` global.
5. **Le visiteur décide.** `prefers-reduced-motion` → niveau léger ; « économiseur de données » → léger ; bouton pause sur le défilement des logos ; `?motion=off` pour tout couper.
6. **Qualité adaptative mesurée, pas devinée.** Pas de détection de navigateur (user-agent) : le niveau dépend des préférences, du type de pointeur et d'un échantillon de fluidité mesuré une fois par page.

## Niveaux

| Niveau | Quand | Ce qui est actif |
|--------|-------|------------------|
| `complet` | souris (`hover: hover` et `pointer: fine`), fluidité correcte | tout : entrées, apparitions bloc par bloc et carte par carte, compteurs (chiffres clés et vitrine), vitrine animée, orbites en rotation lente, badges flottants, parallaxe au pointeur, inclinaison des cartes |
| `equilibre` | écran tactile, ou `complet` dégradé par la mesure | entrées, apparitions des grandes sections, compteurs des chiffres clés, vitrine animée ; pas d'animation continue décorative, pas d'effet au pointeur, pas d'apparition carte par carte |
| `leger` | réduire les animations, économiseur de données, ou `equilibre` dégradé par la mesure | aucune animation décorative ; seules restent les transitions d'état utiles (survol, focus) — et aucune sous « réduire les animations » |
| désactivé | `?motion=off`, `SITE.motion = false`, `AE_MOTION=off` | site statique, onglets de la vitrine remplacés par les cinq modules les uns sous les autres |

## Bibliothèques évaluées (aucune ajoutée)

| Bibliothèque | Apport possible | Coût | Décision |
|---|---|---|---|
| GSAP + ScrollTrigger | timelines, scroll scrubbing | ≈ 70 Ko min. (≈ 27 Ko compressés) + exécution au démarrage | **Rejetée** : tout ce dont le site a besoin tient en CSS + 4,5 Ko compressés de JS ; la barre de lecture utilise `animation-timeline: scroll()` sans JS |
| Lenis (défilement lissé) | défilement « soyeux » | ≈ 4 Ko + détourne le défilement natif (accessibilité, ancres, clavier, iOS) | **Rejetée** : dégrade le défilement natif sans bénéfice mesurable |
| Three.js / WebGL | scène 3D du héros | ≈ 150 Ko compressés + GPU + batterie | **Rejetée** : contraire à l'objectif 3G ; l'élément graphique est un SVG de 0,6 Ko |
| Lottie | animations vectorielles | lecteur ≈ 60 Ko compressés + fichiers JSON | **Rejetée** : les quelques animations sont faites en CSS/SVG |

## Choix de marque

- Noir, blanc, rouge Agence Elite. Le rouge vif `#fb0000` est utilisé pour les éléments **graphiques** (orbites, courbes, jauges, barre de lecture) ; le texte rouge reste `#e10600` pour garder un contraste AA (5,0:1 contre 4,1:1).
- Polices Montserrat (titres) et Inter (texte), désormais auto-hébergées (sous-ensemble latin, licence OFL).
