# Performance, tests et erreurs : avant / après

Conditions : conteneur Linux du 2026-10-21, Node 22.22, Chromium de Playwright, prévisualisation locale sans donnée
réelle (`scripts/mesure/apercu-local.mjs`). Chaque chiffre « après » sera remesuré par la même commande.

## Départ (lot 0, code de production `ef4ac25`)

| Mesure | Valeur | Commande / preuve |
|---|---:|---|
| `npm ci` | OK | — |
| Tests unitaires (vitest) | 127 / 127 | `npx vitest run` |
| Build | OK | `npm run build` |
| JS initial, build « production » (`index-*.js`) | 422,0 ko (gzip 131,2 ko) | `VITE_SUPABASE_URL=https://exemple-fictif.supabase.co VITE_SUPABASE_ANON_KEY=cle-fictive npx vite build` puis `node scripts/mesure/tailles.mjs` |
| CSS initial | 152,7 ko (gzip 29,9 ko) | idem |
| JS total | 2 179,8 ko en 31 fichiers | idem |
| JS initial, build démo (contrôle CI `< 700 000 octets`) | 596,4 ko | `npm run build` sans variables |
| Parcours e2e Playwright | 33 réussis, 1 ignoré (17 scénarios × 2 appareils) | `npx playwright test` sur `ef4ac25` |
| Erreurs JavaScript (38 écrans × 11 largeurs) | 0 | `mesures/avant.json` |
| Messages d'erreur console | 152, tous « Failed to load resource » (images en ligne bloquées par le bac à sable) sur Photos du site, Elite Store, Paramètres › Identité | idem |
| Requêtes vers une base de production pendant les mesures | 0 | idem (`requetesProduction`) |
| `npm audit --audit-level=high` | **échec** : vite 8.3.0 (faille launch-editor) | corrigé au lot 0 : vite 8.3.5 |

Détail par écran (boutons, champs, débordements, onglets coupés) : `mesures/avant.md`.

## Lot 0 (après les garde-fous)

| Mesure | Valeur |
|---|---:|
| Tests unitaires | 131 / 131 (+4 : aperçu sûr, garde-fou réseau) |
| e2e | 33 réussis, 1 ignoré |
| JS initial build « production » | 422,2 ko (+0,2 ko) |
| JS initial build démo | 390,9 ko (la démo n'embarque plus le client Supabase de la plateforme) |
| `npm audit --audit-level=high` | 0 vulnérabilité |

## Après (lot 7)

À remplir avec les mêmes commandes.
