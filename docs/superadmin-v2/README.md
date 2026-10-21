# SUPERADMIN 2.0 : dossier de la mission

Point de reprise : **`JOURNAL.md`** (fait, décisions, bloqué, prochaine étape, mis à jour à la fin de chaque lot).

| Fichier | Contenu |
|---|---|
| `JOURNAL.md` | Journal lot par lot |
| `audit/` | Copie de l'audit du 2026-10-21 (**absent** : voir `audit/LISEZMOI.md`) |
| `01_ARCHITECTURE_V2.md` | 6 espaces, routes, redirections, dictionnaire de libellés (lot 2) |
| `02_FUNCTION_MAPPING.csv` | Fonctionnalités et leur vérification |
| `03_ACTION_MAPPING.csv` | Actions (boutons) et leur placement |
| `04_REDUNDANCY_RESOLUTION.csv` | Doublons et décision |
| `05_DESIGN_SYSTEM.md` | Renvoi vers `docs/DESIGN_SYSTEM.md` |
| `06_PARCOURS_AVANT_APRES.md` | Parcours du § 11, en clics |
| `07_SECURITY_REGISTER.md` | SEC-01 à SEC-15 |
| `08_FINANCIAL_RULES.md` | Règles de calcul de l'argent |
| `09_TEST_PLAN.md` | Plan de tests |
| `10_PERFORMANCE.md` | Tailles du build, tests, erreurs, avant / après |
| `11_RESPONSIVE_REPORT.md` | 11 largeurs |
| `12_RELEASE_CHECKLIST.md` | Mise en production, migrations, retour arrière, preuve « aucune requête vers la production » |
| `13_FINAL_REPORT.md` | Rapport final |
| `14_HANDOFF.md` | Passation |
| `mesures/` | Résultats bruts des scripts de mesure (`avant.json`, `apres.json`) |
| `CAPTURES/` | Captures avant / après (mêmes écrans, 390 et 1280 px, données fictives) |

## Outils (dans `scripts/`)

| Commande | Rôle |
|---|---|
| `node scripts/mesure/apercu-local.mjs` | Prévisualisation locale sans donnée réelle : CRM en mode aperçu (http://127.0.0.1:4180) + plateforme fictive (http://127.0.0.1:54399). Compte fictif `superadmin.fictif` / `fictif-1234`. |
| `node scripts/mesure/mesurer.mjs --etiquette avant --captures` | Compte boutons, champs, débordements, onglets coupés, erreurs console et requêtes vers la production, sur 38 écrans × 11 largeurs. |
| `node scripts/mesure/resume.mjs avant apres` | Tableaux avant / après en Markdown. |
| `node scripts/mesure/tailles.mjs dist` | Tailles JS / CSS du build. |
| `node scripts/mesure/ctrlk.mjs` | Temps d'ouverture de la recherche Ctrl K (objectif < 300 ms). |
| `node scripts/plateforme-fictive/serveur.mjs` | Plateforme fictive seule (PGlite + vraies migrations, données fictives). |
| `node scripts/plateforme-fictive/synchroniser.mjs` | Recopie l'instantané de la plateforme depuis un dépôt `agence-elite-platform` local. |
