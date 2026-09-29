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

## Étape 3, lot 2 (2026-09-29) : plus de contexte fusionné dans les écrans
- Les 22 fichiers mixtes lisent séparément `useDonnees()` et `useNoyau()`. `useApp` ne reste que dans Sécurité (sauvegarde complète) ; plafond abaissé à 1.

## Étape 4 (2026-09-29, accord « vas-y étape 4 ») : base
- `workspace_id` sur 9 tables métier, rempli à l'insertion depuis `user_id` et verrouillé (trigger `rattacher_espace`) ; rattrapage 0 ligne orpheline, journal d'audit non pollué.
- Table `events` append-only : triggers sur `actions` et `documents`, même correspondance que `core/events.js`, suppression → `annule`. Un échec d'écriture d'événement ne bloque jamais l'utilisateur.
- Vérifié : 1439 + 184 événements = lignes source, sommes des paiements identiques (74 495 500), tests trigger en transaction annulée, visite anonyme du site OK, aucun nouvel avertissement de sécurité.
- Retour arrière : supprimer les triggers `evenement` / `rattacher_espace`, la table `events` et les colonnes `workspace_id` (aucun code ne les lit encore).

## Lot A (2026-09-29, accord « vas-y lot A base ») : accès des membres
- Base (`supabase/acces_membres.sql`, ajout seulement) : règles par espace en plus des règles `user_id` ; prospects/actions/documents : lecture tout membre, écriture membre+, suppression admin+ (ou auteur) ; réglages/site/boutique : lecture membres. Barrière restrictive « espace obligatoire » : aucune ligne d'un espace dont on n'est pas membre (même écrite avant d'être retiré). `store_produits` exclu (catalogue public).
- Adhésions via fonctions contrôlées : `inviter_membre`, `changer_role`, `retirer_membre`, `annuler_invitation`, `membres_espace` ; propriétaire inamovible, pas d'auto-promotion, admin nommé par le propriétaire seul. Invitation = e-mail autorisé + adhésion créée à l'inscription.
- Application : lectures, écritures et remise à zéro filtrées sur l'espace actif (`espaceActif()` dans `store.js`, repli sans filtre si les espaces sont illisibles) ; Paramètres › Membres ; changement d'espace refusé tant que des modifications attendent l'envoi.
- Tests en base (transaction annulée) : membre lit/écrit son espace, 0 accès à l'espace étranger, pas d'usurpation ni d'auto-promotion, lecteur n'écrit pas, membre retiré ne voit plus rien. Après application : Agence Elite 67/67 et Démo 3703/3703 lignes visibles = lignes en base, visite et catalogue anonymes OK. Avertissements attendus : 5 nouvelles fonctions appelables par un compte connecté (elles vérifient elles-mêmes le rôle).
- Hors périmètre : reçus partagés (stockage par utilisateur), réglages modifiables par un admin.

## Lot B (2026-09-29) : l'application lit le journal d'événements
- Aucune modification de base (table `events`, index et règle de lecture déjà en place depuis l'étape 4 et le Lot A).
- `src/core/journal.js` : `lireJournal()` lit `events` (espace actif, non annulés) et le fusionne avec le calcul local (`core/events.js`) : les modifs pas encore envoyées apparaissent, les suppressions locales disparaissent. Hors ligne, mode local ou erreur → repli sur le calcul. `comparerJournal()` mesure les écarts.
- Affichage ajouté, rien de remplacé : onglet « Chronologie » de la fiche (`core/ui/Chronologie.jsx`) ; « Vérifier » dans Paramètres › Sécurité. L'onglet Historique (actions modifiables) et l'activité du tableau de bord restent calculés comme avant.
- Vérifié sur la base : Démo 1616/1616 et Agence Elite 7/7 événements, 0 orphelin, paiements et dépenses identiques ; étape, devis, facture, paiement, dépense testés dans une transaction annulée (suppression → retiré de la chronologie) ; lecture d'une fiche 0,75 ms, 1000 événements 5 ms. Le journal n'est lu qu'à l'ouverture de la Chronologie : démarrage inchangé.
- Retour arrière : retirer l'onglet et la carte (aucune donnée concernée).

## Prochains lots
1. Étape 5 : statistiques côté serveur, chargement par module.
2. Brancher d'autres vues sur le journal (activité du tableau de bord) une fois la Chronologie éprouvée.
