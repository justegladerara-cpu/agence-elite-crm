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

Stack : React + Vite, Supabase (base de données + connexion), hébergé sur Netlify.

## Mise en ligne (une seule fois)

### 1. Supabase (base de données)
1. Crée un compte sur https://supabase.com puis **New project** (nom : `agence-elite`, région : Paris / eu-west-3). Note le mot de passe de la base quelque part.
2. Menu **SQL Editor** → **New query** → colle tout le contenu de `supabase/schema.sql` → **Run**.
3. Menu **Authentication** → **Users** → **Add user** → **Create new user** : ton e-mail et un mot de passe, coche **Auto Confirm User**.
4. Menu **Authentication** → **Sign In / Providers** → désactive **Allow new users to sign up** (toi seul peux te connecter).
5. Menu **Project Settings** → **API** (ou **Data API**) : garde ouverts **Project URL** et la clé **publishable** (`sb_publishable_…`, ou l'ancienne clé **anon public**). Jamais la clé secrète.

### 2. Netlify (hébergement)
1. Crée un compte sur https://netlify.com avec ton compte GitHub.
2. **Add new site** → **Import an existing project** → GitHub → `agence-elite-crm`.
3. Les réglages de build sont lus dans `netlify.toml` (rien à changer).
4. Avant **Deploy**, dans **Environment variables**, ajoute :
   - `VITE_SUPABASE_URL` = la Project URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` = la clé publishable (ou anon public)
5. **Deploy**. Ton CRM est en ligne à l'adresse donnée par Netlify (modifiable dans **Site configuration → Change site name**).

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
