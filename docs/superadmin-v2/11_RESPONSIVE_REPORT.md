# 11 — Rapport des 11 largeurs

Mesuré par `node scripts/mesure/mesurer.mjs` sur 38 écrans × 11 largeurs (320, 360, 375, 390, 430, 768, 820, 1024,
1280, 1440, 1920 px), prévisualisation sans donnée réelle, téléphone simulé sous 768 px. Données brutes :
`mesures/avant.json` et `mesures/apres.json`. Captures : `CAPTURES/avant/` et `CAPTURES/apres/` (38 écrans à 390 et
1280 px, mêmes noms de fichier, soit **38 paires**).

## Totaux

| Indicateur | Avant | Après |
|---|---:|---:|
| Écrans avec défilement horizontal | 0 | 0 |
| Éléments qui sortent de l'écran | 7 | **0** |
| Onglets coupés au bord de l'écran ou tronqués | 151 | **35** |
| Erreurs JavaScript | 0 | 0 |

## Onglets coupés, par largeur

| Largeur | 320 | 360 | 375 | 390 | 430 | 768 | 820 | 1024 | 1280 | 1440 | 1920 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Avant | 38 | 27 | 25 | 25 | 13 | 6 | 6 | 2 | 3 | 3 | 3 |
| Après | 4 | 4 | 4 | 4 | 4 | 2 | 2 | 2 | 3 | 3 | 3 |

Ce qui a été corrigé au lot 7 : sur téléphone, les barres d'onglets (onglets d'espace, onglets de page, onglets de
fiche) passent à la ligne au lieu de défiler avec un onglet à moitié visible. La liste « Colonnes » du cockpit
s'ouvre au centre de l'écran au lieu de sortir à gauche (les 7 éléments qui débordaient).

Ce qui reste (35) : les cartes de filtre des listes Prospects et Clients de l'agence (« Potentiels 51 800 € en
jeu ») dont le texte est raccourci par des points de suspension, et un onglet du Tableau de bord analytique à 320 px.
Ce sont des écrans hors du périmètre super admin ; à reprendre dans une passe dédiée.

## Accessibilité (WCAG AA)

`e2e/design.spec.js` passe axe sur toutes les pages du menu et deux écrans éditeur : aucune violation grave ou
critique. `e2e/tableau.spec.js` refait le contrôle à 320 px avec des données. Contrastes : voir D3-2.
