# CLAUDE JOURNAL — Agence Elite CRM

Mémoire persistante de Claude. Entrées chronologiques, jamais réécrites. `ai/CODEX/JOURNAL.md` appartient à Codex : lu, jamais modifié.
À chaque reprise après Codex : lire d'abord `ai/CODEX/JOURNAL.md` (sur sa branche ou sa PR), puis ce journal.

---

## 2026-10-01 — Reprise après Codex : audit de la PR #1 (aucune fonctionnalité)

### Mission
Lire et auditer le travail de Codex (PR #1 « Pareto V1 », branche `codex/creer-journal-de-memoire-persistante` → `claude/project-thread-j6wx9s`), vérifier Supabase en lecture seule, exécuter les tests, rendre un rapport. Ne pas fusionner, ne rien appliquer en production.

### État au début
- Branche `claude/project-thread-j6wx9s` : HEAD `74ccbd7` (Step 6B, 2026-09-29), arbre propre.
- PR #1 : un seul commit publié `8f74b60`, 20 fichiers, +854/−54, basé sur `74ccbd7`. Les hashes cités dans le journal Codex (`7647e2c`, `6dbd14d`, `0e29dfe`, `97a6b1b`, `feed454`, `dea7439`) n'existent pas sur GitHub : historique local de Codex, publié écrasé dans `8f74b60`. Le contenu correspond aux trois entrées du journal.
- Supabase : projet `agence-elite-crm` (ref `mylgnsuoppplmfaanyze`, eu-west-2, Postgres 17), **production**. Dernière migration : `espace_permissions` (Step 6B). Codex n'a rien appliqué.

### Travail Codex analysé (fichiers)
`ai/CODEX/JOURNAL.md` (lu intégralement), `README.md`, `docs/{DECISIONS,KNOWN_ISSUES,PROJECT_CONTEXT}.md`, `netlify.toml` (supprimé), `scripts/supabase-bootstrap.sh`, `site/build.mjs`, `src/core/permissions.js`, `src/lib/erreurs.js`, `supabase/README.md`, `supabase/bootstrap_prerequis.sql`, `supabase/migrations/20260930180000_pareto_v1_documents_uniques.sql`, `supabase/migrations/legacy-order.txt`, `supabase/owner.sql` (supprimé), `supabase/tests/diagnostic_avant_migration.sql`, `supabase/tests/pareto_v1.sql`, `tests/{core,lib,supabase}.test.js`. Comparé à `src/lib/store.js` (file hors ligne) et `src/pages/Factures.jsx` (contrôle de numéro).

### Commandes et contrôles exécutés aujourd'hui (réels)
Supabase (lecture seule, ou transaction annulée par exception volontaire) :
1. Diagnostic `diagnostic_avant_migration.sql` (requêtes 1 à 6) : **doublons 0, lignes sans espace 0, liens inter-espaces 0, propriétaires incohérents 0, policies `own …` 0**. Inventaire des policies identique au Step 6B.
2. Données réelles : 211 prospects, 1 679 actions, 190 documents, 1 630 événements, 2 espaces, 2 adhésions. Utilisation réelle depuis le 29/09 (dernière action le 2026-09-30).
3. Step 6A sur données réelles : 1 630 événements actifs = 1 630 faits typés, 0 manquant, paiements tables = journal = 74 495 500, 5 événements versionnés (modifications suivies).
4. `crm_single_owner` en production utilise `private.inscriptions_autorisees` (aucun e-mail en dur) : la suppression de `owner.sql` est sans effet sur la base.
5. Couverture du bootstrap : les 25 fonctions `public`/`private`, les 66 policies (dont Storage `own recus …`), les tables, `crm_nouvel_espace` et la tâche cron `envoyer-rappels` de la production sont toutes définies dans les fichiers de `legacy-order.txt`. Bootstrap non exécuté (pas de base vide disponible).
6. Migration d'unicité + `pareto_v1.sql` + doublon simulé (` FAC… ` en majuscules avec espaces), **dans une transaction annulée** : index créé, tous les invariants conformes, doublon refusé (`unique_violation`). Vérifié ensuite : index absent, 190 documents.
7. 2FA : 0 facteur vérifié.

Dépôt (sur `8f74b60`, worktree temporaire) :
- `npm run check` : 0 erreur oxlint (49 avertissements), **70/70 tests**, build OK.
- `npm run build` : `dist/_headers` (no-cache `sw.js`), `dist/sw.js`, `dist/site` (19 pages) présents.
- `npx playwright test` (Chromium `/opt/pw-browsers`) : **25 réussis, 1 ignoré** (ordinateur + téléphone). Première exécution E2E de ce code (Codex n'avait pas Chromium).
- `bash -n scripts/supabase-bootstrap.sh` : OK.

### Constatations — validé
- Migration d'unicité : correcte (partielle, par espace et type, insensible casse/espaces, `journee` exclu), additive, retour arrière = `drop index`.
- `diagnostic_avant_migration.sql` et `pareto_v1.sql` : corrects et non destructifs ; les contrôles 6A/6B correspondent à la production.
- `legacy-order.txt` et `bootstrap_prerequis.sql` : ordre et dépendances cohérents ; garde-fou contre une base existante.
- `peutGerer` dérivé de `settings.edit` : même résultat pour les 4 rôles et le mode local.
- Suppression de `netlify.toml` et de `owner.sql`, suppression de `fcfa` : sans régression.
- Tests ajoutés : pertinents (ordre SQL, présence des contrôles, matrice, parcours métier).

### Problèmes trouvés
1. **Bloquant avant d'appliquer l'index : perte possible d'un devis/facture.** Toute écriture passe par la file hors ligne (`store.js queued` puis `doFlush`, non attendu). Si la base refuse l'opération (hors réseau/auth), `doFlush` la **retire de la file** et affiche le message brut. Avec l'index, un document dont le numéro est déjà pris (créé sur un autre appareil, ou même numéro avec casse/espaces différents, que le contrôle de `Factures.jsx:222` ne voit pas) est accepté à l'écran puis disparaît au rechargement. Le message ajouté dans `erreurs.js` n'est jamais affiché dans ce chemin. Le journal Codex dit l'inverse (« conservera l'opération en file ») : c'est inexact.
2. **Documentation : déploiement du site public perdu.** `PROJECT_CONTEXT.md` a retiré « si `site/` change : aussi `git push origin HEAD:site` ». Or la branche `site` existe et alimente le second projet Cloudflare Pages (`agence-elite-site`, build `node site/build.mjs out`, sortie `out`). Le README ne mentionne que le projet CRM et laisse la branche « au choix » : la branche de production du CRM est `claude/project-thread-j6wx9s`.
3. **Mineur : `KNOWN_ISSUES.md` marque l'unicité « RESOLU V1 »** alors que l'index n'est pas appliqué en production.
4. **Mineur : le bootstrap n'inscrit rien dans l'historique `supabase_migrations`** : une future CLI Supabase pensera qu'aucune migration n'est appliquée. À documenter, pas bloquant.

### Décisions
- Aucune fusion, aucune migration appliquée, aucune donnée modifiée.
- Le travail correct de Codex est conservé tel quel. Corrections proposées, pas encore faites : (1) dans `doFlush`, sur conflit de numéro d'un `saveDoc`, ne pas jeter le document (le renvoyer avec un suffixe et prévenir l'utilisateur, ou le garder en attente) et aligner le contrôle de `Factures.jsx` sur `lower(trim)` ; (2) rétablir la consigne branche `site` et le second projet Cloudflare dans la doc ; (3) laisser `KNOWN_ISSUES` en « à appliquer » jusqu'à la migration.

### Fichiers modifiés
- Créé : `ai/CLAUDE/JOURNAL.md` (ce fichier). Aucun autre fichier.

### État final
- Production saine et conforme au Step 6B ; Step 6A cohérent sur les données réelles.
- PR #1 : fusionnable après la correction de doc (2) ; l'index ne doit être appliqué qu'après la correction (1).
- Statut V1 : 🟠 exploitable avec précautions (sauvegarde Supabase à confirmer dans le tableau de bord, 2FA non activée, correction (1) avant l'index).

### Prochaine étape
1. Correction (1) + test, puis application de l'index en production après sauvegarde et `pareto_v1.sql`.
2. Correction doc (2)(3), puis fusion de la PR #1.
3. Activer la 2FA du compte propriétaire et confirmer les sauvegardes Supabase.

### À transmettre à Codex
- Ton travail est validé sur le fond : diagnostic, contrôle `pareto_v1.sql`, migration d'unicité, ordre de bootstrap, permissions, suppression Netlify/`owner.sql`. Exécutés aujourd'hui sur la vraie base (diagnostic) et en transaction annulée (migration + contrôle) : tout est conforme.
- Les E2E tournent ici : 25/25 sur ton commit `8f74b60`.
- Attention à la file hors ligne : `doFlush` jette toute opération refusée par le serveur (voir problème 1). Toute nouvelle contrainte en base doit être pensée avec ce comportement.
- Ne retire pas la consigne de la branche `site` : deux projets Cloudflare Pages existent (CRM sur `claude/project-thread-j6wx9s`, site public sur `site`).
- Les hashes de ton journal ne sont pas sur GitHub (seul `8f74b60` l'est) : cite le commit publié.
- L'index `documents_workspace_type_numero_unique` n'est **pas** appliqué en production au 2026-10-01.
