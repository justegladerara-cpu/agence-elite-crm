# Agence Elite CRM : contexte compact

Lire d'abord ce fichier, puis DECISIONS.md et KNOWN_ISSUES.md. Le code reste la source de vérité.

## Stack
- React 19 + Vite, JS (pas de TS), pas de routeur ni de lib d'état. Routage hash `#/route?onglet=` (`useRoute`, App.jsx), pages `lazy`.
- Supabase (projet mylgnsuoppplmfaanyze) : Postgres + RLS, Auth, Storage (bucket `recus`), Realtime, Edge function `rappels`, pg_cron.
- Hébergement Cloudflare Pages : push sur `claude/project-thread-j6wx9s` = déploiement (crm.agence-elite.fr). Si `site/` change : aussi `git push origin HEAD:site`.
- PWA : `public/sw.js` (version + assets injectés par le plugin vite `swBuild`).

## Structure
- `src/App.jsx` → NAV, APPS (7 applis : entrees), routes, contexte `AppCtx` (`useApp()`), realtime, raccourcis.
- `src/ui.jsx` composants communs · `src/charts.jsx` graphiques SVG · `src/icons.jsx` · `src/index.css` (unique feuille, jetons CSS, Inter).
- `src/core/` noyau : `modules.js` (registre, activation `settings.modules`, dépendances), `permissions.js` (rôles → `module.view/edit`), `events.js` (événements dérivés d'actions/documents + bus `emettre/ecouter`). Voir `docs/ARCHITECTURE.md`.
- `src/lib/` logique pure : `store.js` (accès données, file hors ligne), `logic.js` (`computeAll`, `computeStats`), `cockpit.js`, `drill.js`, `tresorerie.js`, `invoice.js`, `invoicePdf.js`, `excel.js`/`tableur.js`/`zoho.js`, `rappels.js`, `journee.js`, `insta.js`, `hub.js`, `theme.js`, `defaults.js`.
- `src/pages/` un fichier par écran (Cockpit, Dashboard, Hub, Factures, Finances, Charges, Parametres, Boutique, SiteWeb…).
- `site/` site vitrine statique (`build.mjs` → `dist/site`, données `data.mjs`, `assets/store.js`).
- `supabase/*.sql` copie lisible des migrations · `supabase/functions/rappels`.
- `tests/lib.test.js`, `tests/core.test.js` (vitest) · `e2e/parcours.spec.js` (Playwright + axe) · `.github/workflows/ci.yml`.

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
- RLS `user_id = auth.uid()` + politique restrictive 2FA `private.mfa_ok()` sur toutes les tables.

## Conventions
- Textes UI en français, tutoiement. Commentaire d'une ligne en tête de fichier.
- Montants FCFA/EUR via réglages ; dates `lib/dates.js`.
- Petites fonctions pures dans `lib/`, testées dans `tests/lib.test.js`.

## Commandes
- `npm run check` (oxlint + vitest + build) · `npm run test:e2e` · `npm run dev`
- CI : lint, tests, build, bundle < 700 Ko, e2e, npm audit.

## Comptes
- Propriétaire unique (uid 759b0b53-…) + démo demo@agence-elite.fr (reset `supabase/demo.sql`).
