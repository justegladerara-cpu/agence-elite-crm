# 09 — Plan de tests

Toutes les vérifications tournent sans donnée réelle : mode démo du CRM et plateforme fictive (`e2e/aides.js`,
`scripts/plateforme-fictive/`). Aucun appel à une base de production, aucune vraie session super admin.

## Ce qui tourne à chaque PR (CI « controle »)

| Contrôle | Commande | Seuil |
|---|---|---|
| Lint | `npm run lint` (oxlint) | 0 erreur |
| Tests unitaires | `npx vitest run` | tous verts |
| Build | `npm run build` | OK, JS initial < 700 000 octets |
| Parcours navigateur | `npx playwright test` (ordinateur 1366 et téléphone 390) | tous verts |
| Dépendances | `npm audit --audit-level=high` | 0 |

## Scénarios

- **57 scénarios e2e** (× 2 formats = 114 exécutions, 1 sautée volontairement : raccourcis clavier sur téléphone).
  Liste complète avec la fonctionnalité couverte : `02_FUNCTION_MAPPING.csv`.
- **Unitaires** : 179 tests dans 18 fichiers, dont `securite` (SEC-01 à SEC-15), `navigation`, `accueil`,
  `finances`, `apercu`.

| Domaine | Fichier | Scénarios |
|---|---|---|
| Sécurité | `e2e/securite.spec.js` | 8 |
| Navigation | `e2e/navigation.spec.js` | 5 |
| Design, accessibilité, 11 largeurs | `e2e/design.spec.js` | 6 |
| Tour de contrôle (5 états) | `e2e/tableau.spec.js` | 8 |
| Fiche client | `e2e/fiche.spec.js` | 9 |
| Formulaires | `e2e/formulaires.spec.js` | 4 |
| Parcours métier | `e2e/parcours.spec.js` | 17 |

## Mesures (hors CI, avant / après)

`node scripts/mesure/mesurer.mjs --etiquette apres --captures` : 38 écrans × 11 largeurs, boutons, champs,
débordements, onglets coupés, erreurs, requêtes vers la production. Résultats : `mesures/`, `10_PERFORMANCE.md`,
`11_RESPONSIVE_REPORT.md`.

## Lancer en local

```
npm ci
npm run lint && npx vitest run && npm run build
CHROMIUM_PATH=<chrome> npx playwright test
```
