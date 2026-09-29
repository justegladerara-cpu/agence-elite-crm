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

## Lot 2 (2026-09-29) : choix d'une fiche = relation du noyau
| Déplacé | De → vers | Pourquoi |
|---|---|---|
| `ProspectPicker` | `pages/Saisie.jsx` → `core/ui/ProspectPicker.jsx` | relier un devis, une facture, un paiement ou une dépense à une fiche est une capacité commune, pas propre au Commercial |
| recherche de fiche | code du composant → `core/relations.js` (`chercherFiches`, `nomExiste`, purs, testés) | même règle partout, testable sans React |

Règle d'architecture précisée : la logique `.js` de `core/`, `lib/`, `modules/` n'importe jamais l'interface ; les composants communs vivent dans `core/ui/`.
Résultat : dépendances croisées 6 → 4. Tests : 50 unitaires, 22 parcours navigateur, build OK, 0 cycle.

## Lot 3 (2026-09-29) : la saisie d'argent devient un service du noyau
| Changé | Avant → après | Pourquoi |
|---|---|---|
| `SaisieArgent` | défini dans `pages/Tresorerie.jsx` (tableau de bord), importé par Fiche, Cockpit, Drill → défini avec ses formulaires dans `pages/Finances.jsx`, affiché une seule fois par `App.jsx` | un seul propriétaire (les formulaires d'argent) et un seul point d'ouverture |
| ouverture | chaque page gardait son état et importait le composant → `ctx.saisirArgent({ type, edit?, prefill? })` | les modules demandent une saisie au noyau sans connaître le module qui la réalise |
| `modalPour` | `pages/Tresorerie.jsx` → `lib/tresorerie.js` (pur) | règle « quelle fenêtre pour cette action » |
| Hub (clients) | `PaiementForm` chargé depuis Finances → `ctx.saisirArgent` | Commercial ne dépend plus de Facturation |
| Drill | Échap ignoré si l'état local `modal` était ouvert → ignoré si une fenêtre `.modal-bg` est ouverte | même comportement, sans état local |

Résultat : dépendances croisées 4 → 1 (reste `Journee → Impayes`, bouton de relance). Tests : 50 unitaires, 23 parcours navigateur (nouveau : saisie depuis les clients et le tableau de bord), build OK, 0 cycle. Avertissements lint 54 → 51.

## Prochains lots (du moins risqué au plus risqué)
3. `RelanceFactureBtn` → action exposée par le contrat facturation.
4. Domaine par module : `lib/invoice.js` → `modules/facturation`, `lib/insta.js`/`journee.js`/`hub.js`/`appel.js` → `modules/commercial`, `lib/tresorerie.js` → `modules/charges`, `lib/cockpit.js`/`drill.js` → `modules/dashboard` (réexports temporaires pour ne rien casser).
5. Contexte : séparer le noyau (session, réglages, modules) des données par module.
