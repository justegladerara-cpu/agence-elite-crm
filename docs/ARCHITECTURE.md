# Architecture : Core + Modules + Connexions

État constaté au commit `d8c94bb` (audit du 2026-09-29), puis cible et plan de migration progressive.
Règle : chaque étape laisse le logiciel en production fonctionnel, réversible, testé.

## 1. Existant (vérifié dans le code)

```
navigateur
  App.jsx ── useRoute (hash) ── NAV / APPS ── switch des pages
     │
     └─ AppCtx (useApp) : state {prospects, actions, documents, settings} + data = computeAll(...) + api + live
          │
          ├─ lib/* fonctions pures (logic, cockpit, drill, invoice, tresorerie, journee, hub, insta)
          └─ lib/store.js : db = offline(Supabase + cache aecrm-cache + file aecrm-queue) | local(localStorage)
Supabase
  tables (RLS user_id = auth.uid() + restrictive private.mfa_ok())
  RPC publiques : site_visite, site_contact, store_passer_commande
  Edge rappels ← pg_cron 5 min · Realtime : actions, prospects, documents, site_demandes
```

Hypothèses « un seul » trouvées :
| Hypothèse | Où | Statut |
|---|---|---|
| Un seul propriétaire (uid en dur) | `site_visite`, `site_contact`, `store_passer_commande`, politique `catalogue public` | remplacé par l'espace « site public » (`private.site_proprietaire()`) |
| Deux e-mails autorisés en dur | trigger `crm_single_owner` | remplacé par la table `private.inscriptions_autorisees` |
| Un seul compte = un seul espace | toutes les tables (`user_id`) | `workspaces` + `workspace_members` créés (2 espaces), données encore rattachées à `user_id` |
| Un seul contexte global | `AppCtx` porte tout | à découper (étape 3) |
| Chargement total | `fetchAll` au démarrage | à découper (étape 4) |
| Un seul pipeline | `settings.etapes` | acceptable pour l'instant |
| Un seul journal pour tout | table `actions` (étapes, paiements, dépenses) | événements dérivés (étape 1), entités dédiées plus tard |

## 2. Core (noyau commun)

| Brique | Aujourd'hui | Cible |
|---|---|---|
| Identité / compte | Supabase Auth, 2FA TOTP | inchangé |
| Espace de travail | `workspaces` + `workspace_members` (rôle), étape 1b | toutes les données rattachées à `workspace_id` |
| Permissions | `src/core/permissions.js` (rôle → permissions par module) | vérifiées aussi en base (RLS par rôle) |
| Modules | `src/core/modules.js` : registre, activation, dépendances | idem + réglages par module |
| Navigation | dérivée du registre (App.jsx) | idem |
| Événements | `src/core/events.js` : événements dérivés d'`actions`/`documents` + bus local | table `events` écrite par les modules |
| Relations | fiche client (Fiche.jsx), drill.js | `src/core/relations.js` « tout ce qui est lié » |
| Audit / sécurité | `audit_log` (triggers en base), étape 1b | + connexions, exports |
| Réglages | `settings.data` (un JSON) | core / module / utilisateur / espace |
| Fichiers | bucket `recus` | par espace |
| Sync / offline / realtime | store.js, sw.js, canal `crm-direct` | par module |
| Recherche | Recherche.jsx (tout en mémoire) | index par module |
| Notifications | rappels.js + Edge `rappels` | abonnement par événement |

## 3. Modules

Contrat (déclaré dans `src/core/modules.js`) :
`{ id, nom, version, coeur, pages, permissions, entites, evenements: {produits, consommes}, dependances: {requis, optionnels}, reglages }`

| Module | Responsabilité | Données possédées | Écrans | Produit | Consomme | Requis / optionnel |
|---|---|---|---|---|---|---|
| dashboard | agréger, ne possède rien | aucune (vues en localStorage) | dashboard/* | — | tous | core / tous optionnels |
| commercial | prospects, pipeline, relances, journée, appels, Instagram | prospects, actions d'étape, documents `journee` | journee, acquisition, clients, prospect, session, scripts, saisie | prospect.*, client.won | quote.accepted, payment.received | core / agenda, facturation |
| facturation | devis, factures, paiements | documents `devis`/`facture`, actions « Paiement reçu » | devis, factures, facture, paiements | quote.*, invoice.*, payment.received | client.won | core / commercial |
| charges | dépenses, abonnements | actions « Dépense », `settings.depensesFixes` | charges, depenses, abonnements | expense.created | — | core / commercial (client lié) |
| agenda | relances, RDV, échéances | aucune propre (lit prospects, documents) | calendrier | — | prospect.*, invoice.* | core / commercial, facturation |
| site | audience, demandes de contact | site_visites, site_demandes | site, site-demandes, site-pages | site.contact | — | core / commercial (fiche créée) |
| store | boutique de licences | store_produits, store_commandes, store_cles | boutique | store.order | — | core / commercial, facturation |
| parametres | réglages, sécurité, modules | settings | parametres/* | — | — | core (non désactivable) |

Règle d'import : un module n'importe que `core/*`, `lib/*` pur et ses propres fichiers. Les liens entre modules passent par les relations (prospect_id, facture = numéro) ou les événements.
Couplages directs restants : liste `DETTE` de `tests/architecture.test.js`, suivi dans `docs/MIGRATION.md`.

## 4. Connexions (relations métier)

```
Prospect ─(étape Signature/Intervention)→ Client
Client ├─ Devis ─(accepté)→ Facture ─→ Paiement ─→ Chiffre d'affaires
       ├─ RDV / relances (agenda)
       ├─ Dépenses liées (actions « Dépense » avec prospect_id)
       ├─ Demandes site, commandes boutique
       └─ Projets (futur)
Projet (futur) ├─ Client ├─ Factures ├─ Dépenses ├─ Documents └─ Tâches
```
Clés de liaison actuelles : `actions.prospect_id`, `documents.prospect_id`, `actions.facture` (numéro), `documents.data.devisId`, `store_commandes.prospect_id`, `site_demandes.prospect_id`.

## 5. Événements vs entités

- Entité = ce qui existe (prospect, facture, paiement, dépense). Événement = ce qui s'est produit (`payment.received`).
- Aujourd'hui `actions` mélange les deux : un paiement ou une dépense est une ligne d'action. On ne l'étend pas brutalement.
- Étape 1 : `events.js` dérive des événements typés depuis `actions` et `documents` (sans changer la base) : `{ id, type, date, acteur, module, entite, entiteId, meta, correlationId }`.
- Étape suivante : table `events` (append-only) écrite en parallèle ; puis paiements et dépenses deviennent des entités (`payments`, `expenses`) avec migration + fallback de lecture depuis `actions`.

Correspondance actions → événements :
| action | événement |
|---|---|
| Ajout prospect | prospect.created |
| Premier contact, Relance, Échange / suivi | prospect.contacted |
| Qualification | prospect.qualified |
| Audit réalisé, Loom envoyé, Démo présentée | prospect.demo |
| RDV | appointment.created |
| Proposition envoyée | proposal.sent |
| Signature, Intervention | client.won |
| Perdu | prospect.lost |
| Vente additionnelle | client.upsell |
| Paiement reçu | payment.received |
| Dépense | expense.created |
| Commande boutique | store.order |
| Demande site web | site.contact |
| document devis / facture | quote.created / invoice.created |

## 6. Espace de travail et permissions

```
User ─ Membership(rôle) ─ Workspace ─ Modules activés
```
- Tables : `workspaces (id, nom, owner_id, site_public)`, `workspace_members (workspace_id, user_id, role)`. Rôles : proprietaire, admin, membre, lecteur.
- Un espace par compte existant (Agence Elite, Démo). Les données restent sur `user_id` : la bascule vers `workspace_id` se fera table par table (colonne ajoutée, backfill, RLS double, puis lecture par espace).
- Permissions : `module.view` / `module.edit` (+ `settings.edit`, `security.manage`). Propriétaire = tout.

## 7. Modèle financier (préparé, non implémenté)

| Type | Sens | Exemple |
|---|---|---|
| revenu | entrant | paiement client |
| dépense | consommé | taxi, abonnement |
| transfert | déplacement entre deux comptes, jamais deux dépenses | entreprise → compte perso |
| avance | une partie paie pour l'autre, crée une créance | Juste avance l'abonnement de l'agence |
| créance / dette | solde dû | l'agence doit 15 000 FCFA à Juste |
| remboursement | règle une avance ou une dette | l'agence rembourse Juste |

Futur `money_movements (espace_source, espace_cible, compte, type, montant, date, lien_entite, lien_evenement)` : un taxi payé par l'entreprise pour un RDV client = une seule dépense liée au RDV et au client ; si Juste l'a payé perso, une avance en plus, pas une deuxième dépense. Le module Vie perso sera un espace « Personnel » avec ses propres comptes.

## 8. JSON : que faire de chaque champ

| JSON | Décision |
|---|---|
| `prospects.fiche` (téléphone, canal, ville, besoin, audit…) | reste flexible ; `telephone`, `canal`, `statut` pourront devenir des colonnes (recherche serveur) |
| `documents.data` devis/facture (lignes, client, échéance, statut) | vraie entité : colonnes `date`, `echeance`, `total`, `statut` d'abord, lignes ensuite |
| `documents` type `journee` | appartient à commercial, reste JSON |
| `settings.data` | à séparer en core / modules / utilisateur (clés par module, même table) |
| `settings.depensesFixes` | vraie entité (abonnements) à terme |
| `store_commandes.client`, `lignes` | restent JSON (instantané au moment de la commande) |

Chaque migration : ancienne donnée → nouvelle structure → script → vérification des totaux → lecture de secours sur l'ancien champ.

## 9. Couches cibles

UI (pages) → Application (cas d'usage : `api` du contexte) → Domaine (`lib/*` pur, testé) → Données (`store.js`) → Infrastructure (Supabase, Realtime, Storage, push).
Les fonctions pures existantes restent et se regroupent par module sans réécriture.

## 10. Chargement des données

Aujourd'hui tout est chargé (`fetchAll`, pages de 1000). Cible : noyau minimal (réglages, espace, modules) + chargement par module + cache + pagination + filtres serveur. Prérequis : les statistiques et étapes calculées côté serveur (vues SQL ou RPC), sinon les chiffres seraient faux.

## 11. Plan de migration

| Étape | Contenu | État |
|---|---|---|
| 0 | Audit, cartographie, ce document | fait |
| 1a | Registre des modules (activation, dépendances, permissions), événements dérivés + bus, section Paramètres › Modules | fait (2026-09-29) |
| 1b | Base : espaces + adhésions, fin des uid/e-mails en dur (`supabase/espaces.sql`), journal d'audit (`supabase/audit.sql`) | fait (2026-09-29), vérifié : 0 identifiant en dur, catalogue et visites OK en anonyme, audit testé |
| 2 | Découplage par lots (`src/modules/<id>` + contrat `index.js`), règle d'import vérifiée par `tests/architecture.test.js` | en cours (lots 1 à 8 faits) |
| 3 | Contexte découpé : core (session, espace, réglages) + données par module | à faire |
| 4 | Table `events` écrite en parallèle ; `workspace_id` sur les tables métier | à faire |
| 5 | Calculs lourds côté serveur, chargement à la demande | à faire |
| 6 | Entités paiements / dépenses / abonnements, module Projets, module Vie perso | à faire |
