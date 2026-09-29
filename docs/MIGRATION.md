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

## Checkpoint (2026-09-29 08:20)
Analyse sans modification envoyée à Juste : noyau encore petit (`core/` ≈ 350 lignes) mais noyau de fait = `App.jsx`, `ui.jsx`, `lib/logic.js`, `store.js`. Risques notés : `logic.js` mélange pipeline commercial et statistiques ; composants métier dans `ui.jsx` ; pastilles métier dans `App.jsx` ; Paramètres règle tous les modules ; contexte = toutes les données pour tous ; bus d'événements sans abonné.

## Lot 4 (2026-09-29) : contrat d'interface de la Facturation
| Changé | Avant → après | Pourquoi |
|---|---|---|
| `pages/Impayes.jsx` | page → `modules/facturation/ui.jsx` (bouton `RelanceFactureBtn`) | Ma journée affiche un composant de la Facturation par son contrat d'interface |
Règle : un module s'utilise de l'extérieur par `index.js` (domaine) ou `ui.jsx` (composants). Dépendances croisées entre pages : 1 → 0.

## Lot 5 (2026-09-29) : chaque module possède son domaine
| Déplacé | Vers | Pourquoi |
|---|---|---|
| `lib/invoice.js`, `invoicePdf.js`, `whatsapp.js`, `zoho.js` | `modules/facturation/` | calculs, PDF, messages et import des factures appartiennent à la Facturation |
| `lib/insta.js`, `journee.js`, `hub.js` | `modules/commercial/` | prospection, journée, catégories de clients |
| `lib/cockpit.js`, `drill.js` | `modules/dashboard/` | agrégations propres au tableau de bord (aucun autre module ne les utilise) |
| `copier` (presse-papiers) | `lib/insta.js` → `lib/copier.js` | utilitaire commun : la Facturation n'importe plus le Commercial |
| rappels | `lib/rappels.js` importait `statutDe` → reçoit `statutFacture` en paramètre (fourni par App) | le noyau ne dépend d'aucun module ; sans Facturation, pas de rappel de facture |
Contrats : `modules/facturation/index.js` (impayés, statut, totaux, `chargerPdf`, `chargerZoho` à la demande), `modules/commercial/index.js` (`lienHub`, `categorie`, `fichesHub`, `ligne`, `SOURCES`). Tableau de bord : pas de contrat (personne ne l'importe).
Nouvelle règle testée : `core/` et `lib/` n'importent aucun module.
Résultat : 0 dépendance croisée entre pages, 0 contournement de contrat, 0 cycle. Bundle principal 398 → 372 Ko. Tests : 53 unitaires, 23 parcours navigateur, build OK.

## Lot 6 (2026-09-29) : `logic.js` découpé
- `computeAll` (étapes, relances, scores, clients) → `modules/commercial/pipeline.js` ; `computeStats`, `periodeFor`, séries → `modules/dashboard/stats.js`.
- `lib/logic.js` ne garde que le vocabulaire commun (types d'actions, montants, liens). `lib/rappels.js` reçoit `statutFacture` en paramètre (inversion : plus d'import de la Facturation).

## Lot 7 (2026-09-29) : composants du Commercial hors du kit commun
- `Score`, `RelanceTag`, `ContactButtons` → `modules/commercial/ui.jsx`. Restent partagés dans `ui.jsx` : `StageBadge`, `LienProspect`, `LienDoc` (utilisés par tous les modules).

## Lot 8 (2026-09-29) : pastilles du menu déclarées par les modules
- `modules/commercial/pastilles.js` (relances, clients à surveiller), `modules/facturation/pastilles.js` (factures en retard, devis en attente), exportées par `index.js`.
- `App.jsx` n'agrège que les pastilles des modules actifs. Vérifié : 55 tests unitaires, 23 e2e, build OK, 0 cycle.

## Lot 9 (2026-09-29) : sections de Paramètres rattachées à leur module
- Registre : `sections` par module (Commercial → Scripts, Agenda → Rappels) ; `sectionAccessible()` dans le noyau.
- Section d'un module désactivé : retirée du menu, l'URL retombe sur Identité. Sections mixtes (Facturation/devise, Listes, Objectifs) restent communes : la devise sert partout.

## Étape 3, lot 1 (2026-09-29) : contexte noyau / données
- `src/core/contexte.js` : `NoyauCtx` (settings, api, toast, openAction, saisirArgent, live) et `DonneesCtx` (prospects, actions, documents, data). `useApp` = fusion, gardé pour compatibilité.
- 46 composants passés à `useNoyau` / `useDonnees` ; 23 fichiers mixtes gardent `useApp` (plafond vérifié par `tests/architecture.test.js`). `ui.jsx` ne porte plus le contexte (lint 51 → 49).

## Prochains lots
1. Migrer les 23 utilisateurs de `useApp` (plafond à abaisser à chaque lot).
2. Mémoïser le noyau pour que les écrans « noyau seul » ne se redessinent plus à chaque changement de données.
3. Étape 4 (base, accord requis) : table `events`, `workspace_id` sur les tables métier.
