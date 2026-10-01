# Agence Elite CRM : contexte compact

Lire d'abord ce fichier, puis DECISIONS.md et KNOWN_ISSUES.md. Le code reste la source de vérité.

## Stack
- React 19 + Vite, JS (pas de TS), pas de routeur ni de lib d'état. Routage hash `#/route?onglet=` (`useRoute`, App.jsx), pages `lazy`.
- Supabase (projet mylgnsuoppplmfaanyze) : Postgres + RLS, Auth, Storage (bucket `recus`), Realtime, Edge function `rappels`, pg_cron.
- Hébergement Cloudflare Pages, deux projets reliés à `justegladerara-cpu/agence-elite-crm` : CRM `agence-elite-crm` (branche `claude/project-thread-j6wx9s`, `npm run build` → `dist`, `crm.agence-elite.fr`) et site public `agence-elite-site` (branche `site`, `node site/build.mjs out` → `out`). Push sur `claude/project-thread-j6wx9s` = déploiement du CRM. Si `site/` change : aussi `git push origin HEAD:site`.
- PWA : `public/sw.js` (version + assets injectés par le plugin vite `swBuild`).

## Structure
- `src/App.jsx` → NAV, APPS (7 applis : entrees), routes, contextes `core/contexte.js` (`useNoyau()` réglages+services, `useDonnees()` données ; `useApp()` = fusion, seulement Sécurité), realtime, raccourcis.
- `src/ui.jsx` composants communs · `src/charts.jsx` graphiques SVG · `src/icons.jsx` · `src/index.css` (unique feuille, jetons CSS, Inter).
- `src/core/` noyau : `modules.js` (registre, activation `settings.modules`, dépendances), `permissions.js` (rôles → `module.view/edit`), `events.js` (événements dérivés d'actions/documents + bus `emettre/ecouter`), `relations.js` (recherche de fiche) ; `core/ui/` composants communs (`ProspectPicker`). Voir `docs/ARCHITECTURE.md`.
- `src/modules/<id>/` domaine d'un module + contrat `index.js` (seul point d'entrée pour les autres). Existent : `facturation` (index.js + ui.jsx), `commercial` (index.js), `dashboard` (interne). Règles : `core/` et `lib/` n'importent aucun module ; entre modules, uniquement `index.js`/`ui.jsx`. Journal : `docs/MIGRATION.md`.
- `src/lib/` services partagés : `store.js` (accès données, file hors ligne), `logic.js` (calcul global), `tresorerie.js`, `excel.js`/`tableur.js`, `rappels.js`, `copier.js`, `theme.js`, `defaults.js`. Les statistiques et le domaine d'appel vivent désormais dans `src/modules/`.
- `src/pages/` un fichier par écran (Cockpit, Dashboard, Hub, Factures, Finances, Charges, Parametres, Boutique, SiteWeb…).
- `site/` site vitrine statique (`build.mjs` → `dist/site`, données `data.mjs`, `assets/store.js`).
- `supabase/*.sql` scripts historiques · ordre reproductible, migration V1 et contrôles dans `supabase/README.md`, `supabase/migrations/` et `supabase/tests/` · `supabase/functions/rappels`.
- `tests/lib.test.js`, `tests/core.test.js`, `tests/architecture.test.js` (frontières, cycles, liste DETTE) (vitest) · `e2e/parcours.spec.js` (Playwright + axe) · `.github/workflows/ci.yml`.

## Modules (applis du menu)
- Tableau de bord → cockpit, acquisition, conversion, finances, drill-down
- Commercial → Ma journée, prospects, hub clients, session d'appels, scripts, Instagram express
- Facturation → devis, factures (PDF, WhatsApp), paiements
- Charges → dépenses, abonnements (`settings.depensesFixes`)
- Agenda → calendrier
- Site web → audience, demandes, pages, Elite Store (produits, commandes, clés)
- Paramètres → identité, facturation, objectifs, listes, scripts, rappels, Excel, sécurité, compte

## Données
- `prospects` (name + `fiche` JSON) 1─n `actions` (tout événement : étape, appel, « Paiement reçu », « Dépense ») 
- `documents` (type facture | devis | journee, `numero`, `data` JSON) → prospect
- `settings` (1 JSON par compte : étapes, objectifs, listes, identité, charges fixes)
- `store_produits/commandes/cles`, `site_visites/demandes`, `rappels`, `push_subscriptions`, `push_config`, `client_errors`
- Étape d'un prospect et statut d'une facture = calculés (non stockés).
- RLS métier par `workspace_id` + adhésion + rôle (Step 6B), avec politique restrictive 2FA `private.mfa_ok()`. Les anciennes policies métier `user_id = auth.uid()` ont été retirées ; `user_id` conserve l'auteur.

## Conventions
- Textes UI en français, tutoiement. Commentaire d'une ligne en tête de fichier.
- Montants FCFA/EUR via réglages ; dates `lib/dates.js`.
- Petites fonctions pures dans `lib/`, testées dans `tests/lib.test.js`.

## Commandes
- `npm run check` (oxlint + vitest + build) · `npm run test:e2e` · `npm run dev`
- CI : lint, tests, build, bundle < 700 Ko, e2e, npm audit.

## Comptes
- Espaces : `workspaces` (Agence Elite = `site_public`, Démo) + `workspace_members` (rôle). Site/boutique lisent `private.site_proprietaire()`. Inscriptions : `private.inscriptions_autorisees`.
- Journal d'audit : `audit_log` rattaché à `workspace_id` (triggers `journal_audit`, lecture propriétaire/admin), distinct du journal métier `events`. Step 6A fait refléter à `events` l'état courant des actions/documents avec versionnement.
- Démo demo@agence-elite.fr (reset `supabase/demo.sql`).
