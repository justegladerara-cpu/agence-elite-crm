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

## Après (lot 7, branche `claude/superadmin-v2-lot-7`)

Mêmes commandes, même conteneur.

| Mesure | Départ | Après | Objectif § 10 |
|---|---:|---:|---|
| Tests unitaires (vitest) | 127 | **179 / 179** | — |
| Parcours e2e Playwright | 33 réussis, 1 ignoré (17 scénarios) | **125 réussis, 1 ignoré (57 scénarios × 2 formats)** | ≥ 40 scénarios ✓ |
| Lint (oxlint) | 0 erreur | 0 erreur | — |
| JS initial, build « production » | 422,0 ko (gzip 131,2 ko) | **428,0 ko (gzip 133,1 ko), +1,4 %** | ≤ +10 % ✓ |
| CSS initial | 152,7 ko | 161,7 ko | — |
| JS initial, build démo (CI < 700 000 octets) | 596,4 ko | 418,4 ko | ✓ |
| Ouverture de la recherche Ctrl K | 316 ms au premier appui (mesuré au début du lot 7), ~12 ms ensuite | **19 ms au premier appui, ≤ 16 ms ensuite** | < 300 ms ✓ (`scripts/mesure/ctrlk.mjs`) |
| Erreurs JavaScript (38 écrans × 11 largeurs) | 0 | **0** | 0 ✓ |
| Messages d'erreur console | 152 | 78 (tous « Failed to load resource », images en ligne bloquées par le bac à sable) | — |
| Requêtes vers une base de production pendant les mesures | 0 | **0** | 0 ✓ |
| `editeur_comptes` | lu à chaque ouverture de fiche | lu seulement à l'ouverture de l'onglet Comptes, gardé 2 min | ✓ (e2e « comptes : lus seulement à l'ouverture de l'onglet ») |
| `npm audit --audit-level=high` | échec (vite 8.3.0) | 0 vulnérabilité | ✓ |

Ctrl K : la cause des 316 ms était React, qui retarde d'environ 300 ms le premier affichage d'un écran chargé à la
demande. La recherche est maintenant chargée quand le navigateur est libre, puis affichée directement.

Détail par écran : `mesures/apres.md` (boutons et champs à 390 et 1280 px, avant / après).
