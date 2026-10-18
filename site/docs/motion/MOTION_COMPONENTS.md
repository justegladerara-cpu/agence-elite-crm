# Composants animés

| Composant | Où | Mouvement | Niveaux | Sans JS / réduit |
|---|---|---|---|---|
| **Héros** | accueil | cascade du surtitre, titre, texte, boutons, points (`ems-monte`, 70 ms d'écart) ; photo qui glisse (`ems-glisse`, sans opacité) ; surlignage rouge du titre ; reflet unique du bouton principal à 1,3 s | complet, équilibré | statique, tout visible |
| **Orbites** (SVG 0,6 Ko) | derrière la photo du héros | rotation 90 s, parallaxe au pointeur (8 px) | rotation + parallaxe : complet | dessin fixe |
| **Badges du héros** | accueil | apparition avec rebond, flottement 4,5 s, parallaxe 20 px | flottement/parallaxe : complet | fixes |
| **Bandeaux intérieurs** | solutions, secteurs, agence, contact, légal | même cascade que le héros, image en `ems-glisse` | complet, équilibré | statiques |
| **En-tête** | toutes | soulignement animé de la rubrique (survol, ouverte, active + `aria-current`) ; barre de lecture rouge liée au défilement (`animation-timeline: scroll()`, sans JS, navigateurs compatibles) | soulignement : tous ; barre : `.mo` | barre absente |
| **Menu mobile** | ≤ 1000 px | rubriques en cascade (40 ms) ; focus dans le menu, Échap referme et rend le focus | complet, équilibré | ouverture instantanée |
| **Apparitions** | toutes | blocs sous le pli : montée 22 px + fondu, cascade de 4 rangs, un seul observateur ; cartes une à une au niveau complet, grandes sections seulement au niveau équilibré | complet, équilibré | visibles d'emblée |
| **Chiffres clés** | accueil, sous le héros | compteur de 0 à la valeur (1,1 s, une fois) ; valeur finale dans le HTML + copie pour lecteurs d'écran | complet, équilibré | valeur finale |
| **Cartes solutions / secteurs** | accueil, solutions | levée, halo rouge qui suit le pointeur, inclinaison ≤ 3° | inclinaison/halo suivi : complet souris | levée simple |
| **Vitrine de gestion** (données fictives) | accueil, page ERP | 5 onglets ARIA (Tableau de bord, Ventes, Stock, Facturation, Établissements) ; barres et jauges qui poussent (`scale`), courbe qui se trace, anneau d'encaissement, indicateurs comptés ; relancé à chaque onglet, seulement une fois la vitrine à l'écran (indicateurs comptés au niveau complet) | complet, équilibré | 5 modules affichés les uns sous les autres |
| **Logos partenaires** | accueil | défilement 45 s ; pause au survol, au focus, hors écran, onglet masqué, et **bouton pause** | tous | figés, liste unique centrée |
| **Boutons** | toutes | reflet au survol, flèche qui avance, appui à 97 % | tous | transitions coupées sous réduction |
| **Formulaire de contact** | contact | champ invalide qui « secoue » ; message « prêt dans WhatsApp / la messagerie » (`role="status"`) | secousse : `.mo` | message affiché sans animation |
| **Bouton WhatsApp flottant** | toutes | apparition à 0,9 s, deux ondes à 5 s, appui | `.mo` | fixe |
| **FAQ** | pages solution | ouverture en hauteur fluide (`interpolate-size`, navigateurs compatibles) | `.mo` | ouverture instantanée |
| **Changement de page** | même origine | fondu croisé 220 ms (`@view-transition`), en-tête stable | sans réduction | navigation normale |

## Vitrine : données

Toutes les données sont **inventées** et annoncées comme telles (« Démonstration : données fictives, interface simplifiée ») : entreprises « Société Alpha (démo) », « Cabinet Démo », « Restaurant Exemple », « Entreprise Test », sites A/B/C. Aucune donnée client, aucun appel réseau, aucune intégration de l'application réelle. Pour modifier : `VT_MODULES` dans `site/build.mjs`.
