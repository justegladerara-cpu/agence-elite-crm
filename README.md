# Agence Elite CRM

CRM de pilotage de la prospection Agence Elite, construit sur la logique du fichier
`Agence_Elite_Pilotage.xlsx` : une saisie rapide d'actions, et tout le reste calculé
automatiquement (étapes du pipeline, relances J+2 / J+5 / J+10, score de priorité,
alertes, clients, tableau de bord).

- **Ma journée** : objectifs du jour, relances du jour et en retard, 10 prospects les plus chauds, alertes, clients à surveiller, revue de la semaine, script d'appel.
- **Saisir une action** : une action = une ligne, comme l'onglet Saisie. Nouveau prospect créé à la volée.
- **Prospects** : liste filtrable ou vue pipeline, fiche complète avec historique.
- **Clients** : paiements, reste à encaisser, abonnements, renouvellement, onboarding.
- **Tableau de bord** : KPI avec comparaison au mois précédent, objectifs, entonnoir, canaux, CA mois par mois, analyses.
- **Paramètres** : listes, grille tarifaire, objectifs, relances, alertes, score. Export vers Excel (même fichier, mêmes formules) et import depuis Excel.

Stack : React + Vite, Supabase (base de données + connexion), hébergé sur Cloudflare Pages.

Repository officiel : [`justegladerara-cpu/agence-elite-crm`](https://github.com/justegladerara-cpu/agence-elite-crm).

## Mise en ligne

### 1. Supabase (base de données et authentification)

N'exécute pas seulement `supabase/schema.sql` : le CRM courant dépend aussi des espaces, rôles, événements et Steps 6A/6B. Suis la procédure complète dans [`supabase/README.md`](supabase/README.md), différente pour une base neuve et une base existante.

Les inscriptions sont contrôlées en base par invitations/e-mails autorisés. Les rôles sont **propriétaire**, **administrateur**, **membre** et **lecteur**. La sécurité métier repose sur l'espace actif, l'adhésion et le rôle ; la RLS Supabase reste l'autorité finale.

### 2. Cloudflare Pages (hébergement actuel)
1. Dans Cloudflare Pages, connecte le repository GitHub `justegladerara-cpu/agence-elite-crm`.
2. Sélectionne la branche de production voulue dans le tableau de bord Cloudflare (elle n'est pas imposée dans le repository).
3. Configure la commande de build `npm run build` et le dossier de sortie `dist`.
4. Dans **Environment variables**, ajoute :
   - `VITE_SUPABASE_URL` = la Project URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` = la clé publishable (ou anon public)
5. Déploie. Le domaine de production est `crm.agence-elite.fr`.

Le CRM utilise des routes par hash (`/#/…`) : aucune règle de réécriture SPA n'est nécessaire. Le build copie `public/_headers` dans `dist/_headers` afin que Cloudflare ne mette pas `sw.js` en cache ; le service worker et son inventaire d'assets sont finalisés par `vite.config.js`. Le site public statique est généré sous `dist/site` par la même commande.

Sur téléphone : ouvre l'adresse puis « Ajouter à l'écran d'accueil » pour l'avoir comme une appli.

### 3. Reprendre le fichier Excel
Dans le CRM : **Paramètres → Importer un fichier Excel** → choisis ton `Agence_Elite_Pilotage.xlsx`.
Les lignes « EXEMPLE » sont ignorées.

## Développement local
```
npm install
npm run dev
```
Sans fichier `.env`, le CRM tourne en mode démo (données dans le navigateur).

Contrôle complet local : `npm run check`. Parcours navigateur : `npm run test:e2e` après installation de Chromium avec `npx playwright install chromium`.

## Structure rapide

- `src/` : application CRM, noyau, modules et pages ;
- `site/` : générateur et assets du site public intégré ;
- `supabase/` : schéma historique, migrations, fonctions et contrôles SQL ;
- `tests/` et `e2e/` : tests Vitest et Playwright ;
- `scripts/` : outils d'exploitation contrôlés ;
- `docs/` : architecture, décisions et contexte ;
- `ai/CODEX/` : mémoire persistante des interventions Codex.
