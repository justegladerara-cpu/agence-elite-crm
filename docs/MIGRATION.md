# Journal de migration modulaire

Règles : un lot = petit, sans changement fonctionnel, testé (unitaires, navigateur, build, imports, cycles, routes).
Garde-fou automatique : `tests/architecture.test.js` (cycles, noyau sans UI, pages rattachées à un module, liste `DETTE` des dépendances croisées qui ne doit que diminuer, accès aux modules via `modules/<id>/index.js`).

## État des dépendances (analyse 2026-09-29, avant étape 2)
- 0 cycle. `lib/` n'importe jamais l'interface.
- 11 dépendances directes entre modules différents (10 entre pages + App.jsx → Impayes) :
  - `facturesImpayees` (page Impayes) importé par App, Bilan, Calendrier, Cockpit, Journee
  - `Repartition` (Finances) par Charges
  - `ProspectPicker` (Saisie) par Factures, Finances
  - `SaisieArgent` (Tresorerie) par Fiche
  - `PaiementForm` / `DepenseForm` (Finances) par Hub, Tresorerie
  - `RelanceFactureBtn` (Impayes) par Journee
- Fonctions pures rangées dans des pages : `facturesImpayees`, `lundiProchain` (Rapide), `depensesParCategorie` (DashPlus).

## Lot 1 (2026-09-29) : fonctions partagées sorties des pages
| Déplacé | De → vers | Pourquoi |
|---|---|---|
| `facturesImpayees` | `pages/Impayes.jsx` → `modules/facturation/impayes.js`, exposé par `modules/facturation/index.js` | règle métier de la facturation utilisée par 4 autres modules ; ils dépendent maintenant du contrat, plus d'une page |
| `lundiProchain` | `pages/Rapide.jsx` → `lib/dates.js` | utilitaire de date, rien de métier |
| `Repartition` | `pages/Finances.jsx` → `ui.jsx` | composant d'affichage générique (Charges n'importe plus Facturation) |

Premier dossier de module : `src/modules/facturation/` (domaine pur + contrat `index.js`).
Résultat : dépendances croisées 11 → 6 (liste `DETTE`), App.jsx ne dépend plus d'une page métier pour ses pastilles.
Tests : 48 unitaires (dont 5 d'architecture), 22 parcours navigateur (dont toutes les routes), build OK, 0 cycle.

## Prochains lots (du moins risqué au plus risqué)
1. `ProspectPicker` → composant de relation du noyau (choisir une fiche liée).
2. Formulaires d'argent (`SaisieArgent`, `PaiementForm`, `DepenseForm`) → services d'application facturation/charges ouverts par le noyau (`openAction`), plus d'import direct.
3. `RelanceFactureBtn` → action exposée par le contrat facturation.
4. Domaine par module : `lib/invoice.js` → `modules/facturation`, `lib/insta.js`/`journee.js`/`hub.js`/`appel.js` → `modules/commercial`, `lib/tresorerie.js` → `modules/charges`, `lib/cockpit.js`/`drill.js` → `modules/dashboard` (réexports temporaires pour ne rien casser).
5. Contexte : séparer le noyau (session, réglages, modules) des données par module.
