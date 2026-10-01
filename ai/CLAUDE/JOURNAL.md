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

---

## 2026-10-01 — Corrections avant fusion de la PR #1 (accord de Juste, 05:27)

### Mission
Corriger les 3 problèmes de l'audit sur la branche de la PR (`codex/creer-journal-de-memoire-persistante`), sans fusionner la PR ni appliquer la migration.

### Corrections (commit `3370b31` sur la branche de la PR)
1. **Conflit de numéro devis/facture** (`src/lib/conflits.js` nouveau, `src/lib/store.js`, `src/pages/Factures.jsx`, `src/App.jsx`) :
   - `doFlush` : un `saveDoc` refusé par `documents_workspace_type_numero_unique` n'est plus jeté. Il est gardé dans `localStorage` `aecrm-conflits` (une entrée par document), et le bandeau de synchronisation affiche un message clair (numéro, « change le numéro et enregistre à nouveau »). Les autres refus serveur gardent l'ancien comportement.
   - `load` : les documents en conflit sont réaffichés par-dessus les données serveur/cache avec `conflitNumero: true`. Badge « Numéro à changer » dans la liste, mention dans l'éditeur.
   - `saveDoc` en ligne attend la synchronisation et lève une erreur claire (`droits`, `conflitNumero`) si la base refuse : plus d'enregistrement annoncé à tort. Hors ligne : comportement inchangé (enregistré sur l'appareil, signalé à la synchronisation).
   - Une nouvelle version ou la suppression du document retire le conflit. Le drapeau `conflitNumero` n'est jamais envoyé à la base. `clearOffline` efface aussi la liste.
   - `numeroLibre(type, numero, id)` : contrôle en ligne auprès de la base avant toute écriture (insensible casse/espaces, comme l'index). `Factures.jsx` l'appelle avant de créer actions/prospect/document, et le contrôle local ignore désormais casse et espaces.
2. **Doc Cloudflare** (`README.md`, `docs/PROJECT_CONTEXT.md`, `docs/DECISIONS.md`) : deux projets Pages documentés. CRM `agence-elite-crm` (branche `claude/project-thread-j6wx9s`, `npm run build` → `dist`, `crm.agence-elite.fr`) et site public `agence-elite-site` (branche `site`, `node site/build.mjs out` → `out`, domaine à vérifier dans Cloudflare). Consigne `git push origin HEAD:site` rétablie. Source : configuration créée par Juste le 2026-09-28 (mémoire projet), non revérifiable d'ici (`*.pages.dev` bloqué).
3. **KNOWN_ISSUES** : unicité en `[MED]`, « préparé et validé, index non appliqué en production ».

### Tests exécutés (réels)
- `npx vitest run tests/sync.test.js` : 7/7. Supabase simulé, mêmes erreurs que la base. Couvre : refus en ligne avec message, conservation après rechargement, correction puis synchronisation, hors ligne puis conflit, suppression, contrôle préalable, document non concerné.
- `npm run check` : 0 erreur lint (49 avertissements, inchangé), **77/77** tests, build OK (`npm run build` code 0).
- Playwright complet (Chromium `/opt/pw-browsers`) : **27 réussis, 1 ignoré**, dont le nouveau parcours « numéro déjà utilisé (même en minuscules) refusé avant tout enregistrement » (ordinateur + téléphone). Ce parcours échouait avant la correction (comparaison exacte).
- `git diff --check` : OK.
- Supabase : aucune requête d'écriture, migration non appliquée.

### État final
- PR #1 = `8f74b60` (Codex) + `3370b31` (corrections Claude). Aucun fichier en commun avec `23fee39` (journal Claude) : pas de conflit attendu.
- Prête techniquement à être fusionnée. L'index peut être appliqué après fusion et déploiement, puis sauvegarde, diagnostic et `pareto_v1.sql`.

### Limites connues
- Conflit né hors ligne : les actions liées (intervention avec numéro de facture, paiements renumérotés) ont pu partir avant le document refusé. Elles portent le numéro en conflit jusqu'à ce que l'utilisateur change le numéro et réenregistre (l'éditeur met alors à jour l'action liée et les paiements).
- Le message de conflit remplace un éventuel autre message d'erreur de synchronisation jusqu'au prochain envoi.

### À transmettre à Codex
- Ne réintroduis pas le rejet silencieux dans `doFlush` : `saveDoc` + `estConflitNumero` → `aecrm-conflits`. Toute nouvelle contrainte unique doit avoir le même traitement (conserver, signaler, permettre la correction).
- `src/lib/conflits.js` contient la logique pure. `tests/sync.test.js` simule Supabase via `vi.mock('@supabase/supabase-js')` et `vi.stubEnv` : réutilisable pour tester la file.
- `numeroLibre` est l'API de contrôle préalable ; garde la même règle que l'index (`lower(btrim(numero))`, par espace et type).
- Deux projets Cloudflare : ne supprime pas la consigne de la branche `site`.
- L'index `documents_workspace_type_numero_unique` n'est toujours **pas** appliqué en production.

## 2026-10-01 — Fusion de la PR #1 et vérification du déploiement (GO de Juste, 05:37)

### Mission
Fusionner la PR #1 une fois les contrôles GitHub au vert, vérifier le déploiement Cloudflare et le CRM en production sans écrire en base, puis s'arrêter avant l'étape Supabase.

### Fusion
- Contrôles sur la tête de PR `3370b31` : `controle` ×2 succès, Cloudflare Pages succès (Netlify : ancien projet encore lié, contrôles neutres/succès, non bloquants).
- PR #1 fusionnée par commit de fusion **`0306e72`** dans `claude/project-thread-j6wx9s` (état `clean`, tête vérifiée `3370b31`).

### Vérifications après fusion
- Local sur `0306e72` : `npm run check` → 0 erreur lint, **77/77** tests, build OK.
- Cloudflare Pages (`agence-elite-crm`) sur `0306e72` : « Deployed successfully » (05:37:58 UTC), déploiement `c8868112`. Branche de production → `crm.agence-elite.fr`.
- `crm.agence-elite.fr` et `*.pages.dev` ne sont pas joignables depuis l'environnement cloud (proxy 403) : contrôle visuel à faire par Juste.
- Production Supabase, lecture seule : 211 prospects, 1679 actions, 190 documents, 1630 événements (inchangés depuis l'audit). Index `documents_workspace_type_numero_unique` **absent** (non appliqué, volontairement).

### État final
- Code en production = `0306e72`. Le nouveau code fonctionne sans l'index : le contrôle préalable `numeroLibre` est déjà actif, la gestion des conflits attend l'index.
- Aucune écriture en base, aucune migration.

### Prochaine étape (attend le GO de Juste)
1. Juste confirme une sauvegarde Supabase récente.
2. Relancer `supabase/tests/diagnostic_avant_migration.sql` (lecture seule).
3. Appliquer `supabase/migrations/20260930180000_pareto_v1_documents_uniques.sql`.
4. Lancer `supabase/tests/pareto_v1.sql`.
5. Mettre à jour KNOWN_ISSUES.

### À transmettre à Codex
- PR #1 fusionnée (`0306e72`). Tout nouveau travail part de `claude/project-thread-j6wx9s` à ce commit ou après.
- L'index d'unicité n'est toujours pas appliqué en production : ne le marque pas comme résolu.

## 2026-10-01 — Archivage d'Elite Hôtel et base propre de la plateforme (demande de Juste, 21:19 puis 21:40)

### Mission
Juste ne veut plus d'Elite Hôtel comme projet actif. Il faut l'archiver, le rendre inutilisable et garder le Kangourou intact et fonctionnel, puis préparer une base propre pour la future plateforme. La suppression définitive a été remplacée par un archivage : l'outil Supabase demande une confirmation humaine pour tout DROP, et cette session ne peut pas supprimer une branche GitHub.

### Sauvegardes
- Supabase kangourou-gestion : schéma `sauvegarde_20261001`, avec une copie de toutes les tables Kangourou et `h_*` ainsi que des définitions des fonctions et règles d'accès. Empreintes md5 identiques à la source.
- Dossier projet `archive/a-supprimer/elite-hotel/` : bundle Git de la branche hôtel, `hotel.sql`, données `h_*` en JSON, captures d'écran.
- Dossier projet `kangourou/sauvegardes/` : bundle Git de la branche Kangourou.

### Supabase (kangourou-gestion)
- `compte_unique()` (inscription) remise à la version Kangourou d'origine, sans `h_membres`.
- Tables `h_*` déplacées dans le schéma `archive_elite_hotel_a_supprimer`, tous droits retirés (hors API).
- Fonctions `h_*` neutralisées (null ou false) et renommées `archive_elite_hotel_a_supprimer_*`. Elles restent parce que la règle de stockage `h espace recus` y fait référence.
- Bucket `h-recus` (vide) bloqué. Comptes `pdg@kangou.com` et `demo@kangourou.com` désactivés (bannis).
- Restent en place : la règle `h espace recus`, désormais toujours fausse ; le bucket vide ; 84 anciennes fiches de démo hôtel (types chambre, table, plat, sejour, commande) dans l'espace `demo` du Kangourou, que le code Kangourou n'utilise pas. Le script de suppression définitive est dans le dossier projet.

### GitHub
- Commit `ff35a8b` sur `claude/project-thread-hp6xmt` : l'application est remplacée par un avis « ARCHIVE — ELITE HÔTEL — À SUPPRIMER ». Le service worker efface les caches et se désinscrit. Build Cloudflare : succès.
- Nouvelle branche `archive/a-supprimer/elite-hotel`, même commit. L'ancienne branche ne peut être supprimée qu'à la main.
- La branche Kangourou `claude/project-thread-bm6nwc` (`2c51c6c`) n'a pas été touchée.

### Vérifications Kangourou
- Empreintes md5 identiques avant et après : documents (hors fiches hôtel), actions, membres, réglages, prospects.
- Simulation en tant que `pdg@lekangourou.com` : rôle pdg, espace kangourou, 25 documents visibles.
- Simulation en tant que `narcie@lekangourou.com` (caisse) : écriture d'un reçu dans le bucket `recus` acceptée (transaction annulée).
- Écriture dans `h-recus` refusée.

### Plateforme
- Dossier `plateforme/` (documentation et brouillon SQL non appliqué). Il est provisoire, car la création d'un dépôt GitHub est refusée à cette session (403).

### À transmettre à Codex
- Ne pas réutiliser Elite Hôtel. Ne rien modifier sur la branche Kangourou ni dans les tables Kangourou.
- `plateforme/` n'est pas encore du code. Aucune implémentation sans validation de Juste.
