# Mise en production : liste de contrôle

Rien n'est mis en production sans l'accord écrit de Juste, action par action.

## 1. Prévisualisation : aucune requête vers les bases de production

| Contrôle | Comment | Résultat |
|---|---|---|
| Build d'aperçu Cloudflare (`CF_PAGES_BRANCH` ≠ production) avec les vraies variables Supabase fournies | `CF_PAGES=1 CF_PAGES_BRANCH=claude/superadmin-v2-lot-0 VITE_SUPABASE_URL=https://mylgnsuoppplmfaanyze.supabase.co … npx vite build` | Aucune adresse `https://<base>.supabase.co` de production dans le JS du CRM ; CSP `connect-src 'self' data: blob:` posée dans `index.html` (lot 0) |
| Build de production simulé (`CF_PAGES_BRANCH=claude/project-thread-j6wx9s`) | même commande | Inchangé : variables utilisées, pas de CSP d'aperçu |
| Site vitrine de l'aperçu | `CF_PAGES=1 CF_PAGES_BRANCH=… node site/build.mjs` | `window.AE_SITE = null`, boutique sans base |
| Navigation réelle : 38 écrans × 11 largeurs | `node scripts/mesure/mesurer.mjs` (écoute de toutes les requêtes) | 0 requête vers `mylgnsuoppplmfaanyze` ou `xrlfedosaqtffraadmgk` (`mesures/avant.json`) |
| Parcours e2e | test « toutes les routes s'ouvrent sans erreur ni requête vers une base de production » | vert |
| Garde-fou dans le code | `src/lib/gardeReseau.js` + test unitaire | vert |

Reste à faire avant d'utiliser un aperçu **en ligne** : voir la section du lot 7 (plateforme fictive dans le navigateur).
Les chaînes `mylgnsuoppplmfaanyze` / `xrlfedosaqtffraadmgk` restent présentes dans le JS comme **listes d'interdiction**
du garde-fou et dans les données du site (`site/data.mjs`), jamais comme adresse appelée.

## 2. Ordre de mise en production proposé

À compléter au fil des lots (lot 1 sécurité d'abord).

## 3. Migrations

| Base | Migration | État | Porte |
|---|---|---|---|
| CRM | `20260930180000_pareto_v1_documents_uniques.sql` (unicité des numéros) | **non appliquée** en production (vérifié en lecture seule le 2026-10-21 : index absent, 0 doublon) | accord de Juste + procédure `supabase/README.md` |

## 4. Retour arrière

Chaque lot se retire en annulant sa fusion (`git revert -m 1 <commit de fusion>`) sur une branche, puis PR. Jamais de
`push --force` ni de `rebase` sur la production.
