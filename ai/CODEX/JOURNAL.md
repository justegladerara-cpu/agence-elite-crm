# CODEX JOURNAL — Agence Elite CRM

## 2026-09-30 — Audit initial de reprise

### Mission

Créer la mémoire persistante de Codex, puis établir l'état réel du dépôt hérité de Claude sans modifier le code applicatif. L'audit couvre l'historique Git, la documentation, l'application React, Supabase, le site intégré, les tests/CI et en particulier les Steps 6A et 6B.

### Périmètre et méthode

- Branche auditée : `work`, HEAD `74ccbd7` (`Step 6B : espace, adhésion et rôle font foi…`). Aucun remote Git n'est configuré dans cette copie de travail.
- Historique récent parcouru (40 commits), avec lecture ciblée des diffs `b48df92` (Step 6A) et `74ccbd7` (Step 6B).
- Documentation comparée au code : `README.md`, tous les fichiers `docs/*.md`, configuration, registre des modules, contexte, store, écrans, tests, workflows et SQL Supabase.
- Inventaire suivi : 83 fichiers sous `src`, 18 sous `supabase`, 4 fichiers de tests (`tests` + `e2e`), environ 17 845 lignes sur le périmètre texte principal mesuré.
- Limite : aucun accès à une instance Supabase distante ni à son historique de migrations réel depuis ce checkout ; les affirmations de tests en base et de migrations « appliquées » viennent donc des SQL/commentaires et de `docs/MIGRATION.md`, pas d'une revérification distante pendant cet audit.

### État Git et évolution comprise

- Le projet a évolué rapidement d'un CRM monolithique/local vers une architecture « core + modules » puis vers le multi-espace. Les étapes 1–4 et lots A/B sont documentés comme terminés ; l'étape 5 (calculs serveur et chargement à la demande) et l'étape 6 métier (entités paiements/dépenses/abonnements, Projets, Vie perso) restent à faire.
- La séquence structurante récente est : registre et événements dérivés → séparation des modules → séparation des contextes → `workspace_id` et table `events` → accès membres → lecture du journal → Step 6A → Step 6B.
- Le dépôt ne contient pas de répertoire de migrations Supabase horodatées ni `supabase/config.toml` : les fichiers `supabase/*.sql` sont des scripts lisibles/appliqués manuellement, dépendants d'un ordre implicite. Un environnement neuf ne peut pas être reconstruit sûrement par une seule commande standard.

### Architecture réelle

- Frontend React 19 + Vite 8, JavaScript ESM, sans routeur ni bibliothèque d'état. `src/App.jsx` porte le routage hash, les providers, la session, le temps réel et l'API d'écriture ; les pages sont chargées paresseusement.
- Deux contextes existent dans `src/core/contexte.js` : noyau (réglages/services) et données (prospects/actions/documents/calculs). `useApp` ne subsiste que pour compatibilité/sauvegarde complète.
- Le registre `src/core/modules.js` déclare 8 modules : dashboard, commercial, facturation, charges, agenda, site, store et paramètres. Seuls commercial, dashboard et facturation ont aujourd'hui un dossier de domaine sous `src/modules`; plusieurs modules restent essentiellement organisés en pages.
- La couche données `src/lib/store.js` choisit Supabase si les deux variables Vite sont présentes, sinon un mode local `localStorage`. En ligne, elle maintient cache local et file hors ligne, filtre sur l'espace actif, synchronise et écoute Realtime.
- Le modèle principal reste volontairement générique : `prospects` + `fiche` JSON, `actions` (étapes, paiements et dépenses), `documents` + `data` JSON (devis, facture, journée), `settings.data` JSON. Les états du pipeline et des factures sont calculés côté client.
- Le site vitrine/boutique est séparé sous `site/`, généré par `site/build.mjs` dans `dist/site`; le CRM propose aussi des écrans de gestion audience/demandes/pages/boutique.
- PWA : manifeste, service worker généré/injecté au build et en-têtes statiques présents.

### Fonctionnalités constatées

- **CRM/commercial** : journée, saisie rapide, prospects, pipeline, fiches et historique, relances J+2/J+5/J+10, session d'appels, scripts, Instagram, clients gagnés et alertes.
- **Pilotage** : tableau de bord, cockpit, comparaison de périodes, objectifs, tunnel, canaux, anomalies, drill-down et trésorerie nette.
- **Facturation** : devis/factures JSON, numérotation calculée, génération PDF, partage WhatsApp, paiements représentés par des actions, impayés et échéances. Aucun paiement bancaire réel du CRM n'a été identifié.
- **Charges** : dépenses représentées par des actions, reçus, catégories et abonnements/charges fixes dans les réglages.
- **Site/Store** : site statique, suivi de visites, demandes créant éventuellement une fiche, catalogue, commandes, clés et parcours de paiement explicitement simulé en mode démonstration.
- **Interopérabilité** : import/export du classeur historique via implémentation ZIP/XML maison (`tableur.js`) ; la dépendance vulnérable `xlsx` a été supprimée selon les décisions.
- **Exploitation** : sauvegarde JSON téléchargée manuellement, corbeille locale, synchronisation hors ligne, rappels/push via Edge Function et `pg_cron`.

### Authentification, espaces, rôles et sécurité

- Authentification Supabase par e-mail/mot de passe. L'inscription existe dans l'interface mais la base la limite aux e-mails autorisés/invités. La documentation README qui dit de désactiver les inscriptions et « toi seul » est antérieure au multi-utilisateur.
- 2FA TOTP est implémentée : enrôlement/désenrôlement dans Sécurité, challenge AAL2 à la connexion, et politiques RLS restrictives via `private.mfa_ok()`. Le problème connu indique toutefois 0 facteur activé dans l'instance au dernier audit : mécanisme présent, adoption absente.
- Modèle multi-tenant : `workspaces`, `workspace_members`, rôles `proprietaire`, `admin`, `membre`, `lecteur`; `workspace_id` a été ajouté aux 9 tables métier historiques et à `events`, puis à `audit_log` au Step 6B.
- Matrice métier annoncée et implémentée côté base au Step 6B : propriétaire/admin gèrent ; membre lit/crée/modifie et ne supprime que ses propres lignes ; lecteur lit seulement. L'interface applique des gardes explicatives, mais la sécurité de référence reste la RLS/RPC PostgreSQL.
- Nuance importante : `permissionsDe('admin')` ne donne pas `security.manage`, alors que `peutGerer('admin')` autorise les réglages et que la base autorise la gestion d'espace. Il existe donc deux notions de permission pas entièrement alignées ; le registre de permissions n'est pas utilisé comme garde générale des routes/actions.
- Le rôle actif côté client revient par défaut à `proprietaire` en mode local/hors ligne/lecture impossible. Ce choix conserve l'usage hors ligne ; la base doit refuser à la synchronisation ce qui dépasse le vrai rôle. Risque UX : une opération peut paraître acceptée hors ligne puis échouer plus tard.
- Les reçus Storage restent isolés par utilisateur et ne sont pas partagés à l'échelle de l'espace (hors périmètre explicite du Lot A).
- Les RPC publiques du site et du store sont `security definer`; elles déterminent le propriétaire public via `private.site_proprietaire()` et les scripts leur retirent les identifiants codés en dur.
- CI : lint, unitaires, build, budget du bundle initial (< 700 000 octets), Playwright/axe et `npm audit --audit-level=high`. Les tests d'architecture vérifient cycles, frontières de modules, rattachement des pages et dette autorisée.

### Focus Step 6A — journal d'événements modifiable

- Commit `b48df92`; fichiers principaux : `supabase/evenements_modifications.sql`, `src/core/journal.js`, `src/core/ui/Chronologie.jsx`, `src/pages/Securite.jsx`, tests unitaires et E2E, documentation.
- Le journal métier `events` n'est plus strictement append-only : il représente l'état courant du fait source. Les triggers actions/documents passent de `INSERT/DELETE` à `INSERT/UPDATE/DELETE`; un changement réel incrémente `version`, renseigne `modifie_le`, peut annuler/réactiver l'événement et évite les doublons grâce à `source` unique.
- Toute exception dans les triggers est transformée en avertissement pour ne jamais bloquer l'opération métier. Compromis : disponibilité privilégiée, mais une divergence du journal peut être silencieuse ; la carte « Vérifier » et `comparerJournal` servent à la détecter.
- La Chronologie fusionne journal serveur et événements dérivés localement : cela couvre la latence/file hors ligne et retombe sur le calcul local si la base est absente. Les activités historiques et certains tableaux restent calculés depuis les sources, pas depuis `events`.
- La documentation affirme qu'un test SQL de 18 cas et des contrôles de sommes/comptages ont réussi sur la base le 2026-09-29. Ils ne sont pas présents sous forme de tests SQL automatisés rejouables dans le dépôt.

### Focus Step 6B — espace, adhésion et rôle font foi

- Commit `74ccbd7`; fichiers principaux : `supabase/espace_permissions.sql`, `src/App.jsx`, `src/lib/store.js`, `src/core/permissions.js`, `src/pages/Parametres.jsx`, tests et documentation.
- Les anciennes politiques permissives `own …` fondées sur `user_id` sont supprimées pour prospects/actions/documents/settings afin qu'un ancien auteur rétrogradé ne contourne plus son rôle.
- Les réglages deviennent effectivement une ligne par espace (`settings.workspace_id` unique) et sont écrits par la RPC `enregistrer_reglages`, réservée au propriétaire/admin.
- `audit_log.workspace_id` est ajouté ; le journal technique devient lisible par les gestionnaires de l'espace tout en conservant l'acteur.
- Site et boutique sont administrables par propriétaire/admin de l'espace. Le trigger `rattacher_espace` refuse explicitement un insert vers un espace non autorisé au lieu de le rattacher silencieusement ailleurs.
- L'interface lit rôle et utilisateur actifs, garde toutes les opérations de l'API, affiche la lecture seule et traduit les refus RLS. Les tests unitaires couvrent la matrice des gardes.
- La documentation consigne quatre failles constatées avant migration puis corrigées, et des tests transactionnels avec cinq profils. Là encore, ce harnais de sécurité SQL n'est pas versionné/rejouable dans la CI actuelle : seule la preuve documentaire subsiste.

### Écarts documentation / implémentation et problèmes détectés

1. **Critique pour reprise/déploiement neuf — procédure Supabase obsolète.** `README.md` demande seulement d'exécuter `supabase/schema.sql`, ce qui n'installe ni site/store, ni 2FA, ni espaces, ni accès membres, ni events, ni Steps 6A/6B. La documentation de déploiement pointe aussi Netlify alors que `docs/DECISIONS.md` et `PROJECT_CONTEXT.md` indiquent Cloudflare Pages.
2. **Élevé — migrations non industrialisées.** Les scripts SQL sont ordonnés implicitement, certains redéfinissent les mêmes fonctions/policies/triggers et portent la mention « appliqué » sans registre de migration. Risque de dérive entre production et dépôt et de reconstruction incorrecte.
3. **Élevé — calcul/chargement total côté navigateur.** `fetchAll` charge les tables par pages de 1000 et tous les KPI sont calculés en mémoire. Cela limite la montée en charge et motive l'étape 5 déjà planifiée.
4. **Élevé — tests de sécurité base non persistés.** Les validations des Steps 6A/6B sont riches mais seulement racontées dans `docs/MIGRATION.md`; la CI ne crée pas une base Supabase locale et ne teste pas RLS/RPC/triggers/migrations.
5. **Moyen — modèle financier encore polymorphe.** Paiements et dépenses sont des `actions`; abonnements sont dans `settings`. Cela simplifie l'existant mais réduit contraintes, auditabilité et évolutivité comptable.
6. **Moyen — numéros de documents non uniques en base.** La numérotation est calculée client ; une concurrence peut créer des doublons.
7. **Moyen — permissions UI et rôle de gestion partiellement divergents.** `admin` peut gérer via `peutGerer`/base mais n'a pas `security.manage` dans la matrice ; l'application ne filtre pas systématiquement chaque route/action par les permissions déclarées du module.
8. **Moyen — sauvegarde/corbeille locales.** Date de dernière sauvegarde et corbeille sont liées à l'appareil ; la restauration n'est pas une capacité multi-espace serveur.
9. **Moyen — 2FA disponible mais non activée au dernier constat.** Les politiques restrictives acceptent AAL1 quand aucun facteur vérifié n'existe (`mfa_ok`), donc la protection dépend de l'enrôlement effectif.
10. **Faible — dette qualité.** `npm run check` remonte 54 avertissements oxlint (hooks, pureté de render, fast refresh, variables inutilisées) mais aucune erreur. Index documentés comme manquants : `site_demandes.prospect_id`, `store_cles.user_id`.
11. **Faible — contexte compact périmé.** `docs/PROJECT_CONTEXT.md` décrit encore la RLS principale comme `user_id = auth.uid()` et l'audit comme lisible par le seul propriétaire, contrairement au Step 6B. Il mentionne aussi certains chemins déplacés (`lib/logic.js`, `lib/appel.js`).
12. **À vérifier en production.** Temps réel du dashboard, état exact des migrations distantes, adoption 2FA, protection des mots de passe compromis, intégrité des données et performance n'ont pas été revérifiés durant cet audit.

### Dépendances et livraison

- Dépendances runtime : Supabase JS, React/ReactDOM, jsPDF, JSZip. Développement : Vite, Vitest, Playwright, axe et oxlint. `package-lock.json` est présent.
- `.node-version` et la CI ciblent Node 22. Le build produit des chunks paresseux ; bundle initial observé à 406 530 octets, sous la limite CI de 700 000.
- Aucun remote n'étant configuré, les indications de branches/push Cloudflare dans `PROJECT_CONTEXT.md` ne sont pas vérifiables dans ce checkout.

### Fichiers importants consultés

- Racine/configuration : `README.md`, `package.json`, `package-lock.json`, `.env.example`, `vite.config.js`, `playwright.config.js`, `netlify.toml`, `.github/workflows/ci.yml`.
- Documentation : `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/KNOWN_ISSUES.md`, `docs/MIGRATION.md`, `docs/PROJECT_CONTEXT.md`.
- Noyau/données : `src/App.jsx`, `src/core/{contexte,events,journal,modules,permissions,relations}.js`, `src/lib/store.js`, `src/lib/logic.js`, `src/lib/defaults.js`, `src/lib/tresorerie.js`, `src/lib/rappels.js`.
- Fonctionnel/UI : inventaire intégral de `src/pages`, `src/modules`, `site/`; inspection ciblée de Login, Sécurité, Membres, Paramètres, Chronologie, facturation, charges, dashboard et boutique.
- Base : tous les `supabase/*.sql`, avec attention particulière à `espaces.sql`, `espace_donnees.sql`, `acces_membres.sql`, `evenements.sql`, `evenements_modifications.sql`, `espace_permissions.sql`, `audit.sql`, `double_auth.sql`, `site.sql`, `store.sql`, plus l'Edge Function rappels.
- Tests : `tests/architecture.test.js`, `tests/core.test.js`, `tests/lib.test.js`, `e2e/parcours.spec.js`.

### Fichiers créés / modifiés / supprimés

- Créé : `ai/CODEX/JOURNAL.md` (ce journal).
- Aucun fichier applicatif, documentation existante, migration ou test n'a été modifié ou supprimé, conformément au périmètre imposé.

### Commandes / tests

- `git status --short --branch`, `git log --oneline --decorate --graph -40`, recherches Git Step 6A/6B, `git show`/`git diff-tree` : historique et périmètres confirmés ; aucun remote configuré.
- Inventaires via `find`, `git ls-files`, `wc`, `rg` et lectures `sed`/`cat` : architecture et écarts ci-dessus.
- `npm run check` : **réussi** (code 0) ; 3 fichiers Vitest, 65 tests réussis ; build Vite réussi, 338 modules transformés ; bundle initial 406,53 kB ; 54 avertissements oxlint, 0 erreur.
- `npm run test:e2e` : **non exécutable dans cet environnement** ; Playwright a échoué au lancement car Chromium build 1194 est absent. 12 cas ont rapporté la même erreur avant interruption et 14 n'ont pas été lancés ; il ne s'agit pas d'un échec fonctionnel constaté.
- `npx playwright install chromium` : **échec d'environnement** ; tous les miroirs Playwright ont répondu HTTP 403.
- `npm audit --audit-level=high` : **échec d'environnement** ; endpoint npm audit HTTP 403, donc vulnérabilités non évaluées ici.
- Aucun test contre la base Supabase ni migration SQL n'a été exécuté afin de rester non destructif et faute d'environnement local/distant configuré.

### Décisions prises et justification

- Aucun correctif applicatif pendant cette mission : le demandeur a limité les modifications au journal.
- Le code courant et les SQL Step 6A/6B priment sur les sections anciennes de la documentation lorsqu'ils divergent.
- Les validations distantes racontées par Claude sont conservées comme preuves historiques, mais clairement distinguées des contrôles reproductibles effectués aujourd'hui.
- La prochaine action proposée privilégie la reproductibilité de la base avant l'étape 5 fonctionnelle : poursuivre sur une fondation impossible à reconstruire/tester automatiquement augmenterait le risque multi-tenant.

### État après intervention

- Application statiquement saine : lint sans erreur, 65 tests unitaires/architecture verts, build vert et budget initial respecté.
- E2E et audit des dépendances restent indéterminés dans ce conteneur à cause des téléchargements/API bloqués en 403.
- Dernier état fonctionnel connu : Step 6B terminé ; multi-espace et rôles en place ; Steps 6A/6B cohérents entre code, SQL et tests JS, mais tests SQL non reproductibles dans le dépôt.
- Dette prioritaire : installation/reconstruction Supabase, puis scalabilité (étape 5).

### À transmettre à Claude

- Lire ce journal avant toute nouvelle mission et ajouter une entrée chronologique sans écraser celle-ci.
- Ne pas se fier au README pour reconstruire Supabase : il est antérieur à la chaîne de migrations multi-tenant.
- Préserver la distinction `events` (journal métier à état courant, Step 6A) / `audit_log` (historique technique).
- Préserver la règle Step 6B : l'espace + adhésion + rôle font foi ; ne pas réintroduire de policy permissive `user_id = auth.uid()` qui contourne un rôle.
- Toute évolution de `actions`/`documents` doit maintenir la parité entre dérivation JS (`core/events.js`) et triggers SQL, plus la fusion hors ligne (`core/journal.js`).
- Les chiffres de base consignés dans l'ancien audit (210 prospects, 1675 actions, 187 documents, 1623 événements, etc.) sont historiques au 2026-09-29, pas des invariants actuels.

### Prochaine action recommandée (non exécutée)

Créer une mission dédiée **« fiabilisation de la base et de la reprise »** :

1. choisir et documenter un ordre canonique des SQL existants ;
2. convertir cet ordre en vraies migrations Supabase versionnées et idempotentes, avec bootstrap d'un environnement neuf ;
3. corriger README/PROJECT_CONTEXT pour Cloudflare, multi-utilisateur et procédure complète ;
4. versionner les tests SQL des Steps 6A/6B (RLS, cinq rôles, isolation, triggers, RPC, rollback) et les intégrer à la CI avec Supabase local ;
5. seulement après ce filet, engager l'étape 5 (agrégats serveur + chargement par module/pagination).

---

## 2026-09-30 — Pareto V1

### Objectif

Réduire rapidement les risques majeurs avant usage quotidien, sans refonte : rendre le schéma Supabase compréhensible et reconstructible, conserver les garanties multi-espace des Steps 6A/6B, empêcher les doublons concurrents de devis/factures, aligner la permission de gestion et vérifier le parcours métier critique.

### Analyse ciblée

- Point de départ relu intégralement : entrée d'audit précédente, HEAD `dea7439`, arbre propre.
- Historique de chaque `supabase/*.sql` et dépendances objets/policies/triggers examinés. Ordre réel retenu : socle métier → amorçage 2FA → rappels/site/store/erreurs → politiques 2FA complètes → espaces → audit → `workspace_id` → événements → membres → Step 6A → Step 6B → Realtime.
- Cycle de bootstrap découvert : `site.sql` et `store.sql` utilisent `private.mfa_ok()` avant que `double_auth.sql` puisse être exécuté, mais `double_auth.sql` référence lui-même leurs tables. Une amorce minimale de la fonction est donc nécessaire sur une base neuve.
- Scripts exclus volontairement du schéma : `owner.sql` est remplacé par `espaces.sql`; `demo.sql` efface/recrée des données; `store_catalogue.sql` est un seed qui exige qu'un espace public existe.
- Risque de numérotation confirmé : l'interface détectait les doublons déjà chargés, mais deux navigateurs pouvaient calculer puis insérer le même numéro. Le format actuel peut rester côté client si la base arbitre définitivement la concurrence.
- Divergence permissions analysée : les rôles connus donnaient déjà le bon résultat, mais `peutGerer` recodait propriétaire/admin au lieu de s'appuyer sur `settings.edit`. `security.manage` reste volontairement réservé au propriétaire, car il concerne la sécurité personnelle/critique et n'empêche pas un admin de gérer les réglages autorisés par la base.
- Parcours critique analysé de bout en bout dans les fonctions métier et couvert par un test intégré : prospect → proposition/devis → signature/client → facture → paiement → dépense liée → trésorerie/rentabilité.

### Décisions et justification

1. **Ne pas recopier/réécrire tous les anciens SQL dans une migration géante.** Ils représentent l'historique déjà appliqué. Un manifeste canonique et un bootstrap réservé aux bases vides réduisent le risque sans toucher la production.
2. **Refuser le bootstrap sur une base existante.** Le script teste `public.prospects` et s'arrête : une erreur d'opérateur ne peut pas rejouer le socle sur la production.
3. **Créer une seule migration forward Pareto V1.** L'index unique partiel sur `(workspace_id, type, lower(btrim(numero)))` protège devis et factures, laisse les documents `journee` hors contrainte et conserve les formats existants.
4. **Ne jamais dédupliquer automatiquement.** Si une base contient déjà des doublons, la migration échoue sans modifier les lignes ; l'opérateur doit examiner et corriger les documents concernés.
5. **Contrôler plutôt que reconstruire Steps 6A/6B.** Un SQL non destructif inspecte policies, RPC, triggers UPDATE, rattachements, propriétaires, relations inter-espaces et index unique.
6. **Aligner `peutGerer` sur `settings.edit`.** Cela supprime une deuxième matrice implicite sans créer un nouveau système. Le mode local (`role === undefined`) conserve son fonctionnement historique.
7. **Statut orange tant que la base distante n'est pas vérifiée.** Le code est prêt, mais cette session n'a ni accès PostgreSQL/Supabase ni Chromium ; la migration et le contrôle SQL doivent être appliqués sur la vraie base avant de considérer le risque traité en exploitation.

### Changements réalisés

- `supabase/migrations/legacy-order.txt` : ordre canonique du socle historique.
- `supabase/bootstrap_prerequis.sql` : amorçage minimal et identique de `private.mfa_ok()` pour casser le cycle de dépendances d'une base neuve.
- `scripts/supabase-bootstrap.sh` : bootstrap avec `ON_ERROR_STOP`, ordre canonique, migrations forward et refus d'une base déjà initialisée.
- `supabase/migrations/20260930180000_pareto_v1_documents_uniques.sql` : unicité insensible à la casse/aux espaces des numéros de devis/factures, par espace et par type.
- `supabase/tests/pareto_v1.sql` : vérification non destructive des invariants critiques multi-espace, Step 6A, Step 6B et documents.
- `src/core/permissions.js` : `peutGerer` dérivé de la permission `settings.edit` pour tous les rôles Supabase connus.
- `src/lib/erreurs.js` : message utilisateur spécifique lorsque la base refuse un numéro concurrent.
- `tests/supabase.test.js`, `tests/core.test.js`, `tests/lib.test.js` : ordre/dépendances, présence des contrôles, matrice de gestion, erreur d'unicité et parcours métier critique.
- `README.md`, `supabase/README.md`, `docs/PROJECT_CONTEXT.md`, `docs/KNOWN_ISSUES.md` : procédure base neuve/existante, Cloudflare Pages, état multi-utilisateur et Steps 6A/6B rendus exacts.
- `ai/CODEX/JOURNAL.md` : présente entrée ajoutée sans remplacer l'audit initial.

### Migration et procédure d'exploitation

- **Base existante :** sauvegarder ; exécuter la requête de diagnostic des doublons documentée dans `supabase/README.md`; si elle ne retourne rien, appliquer uniquement `20260930180000_pareto_v1_documents_uniques.sql`; puis exécuter `supabase/tests/pareto_v1.sql`.
- **Base neuve :** utiliser `DATABASE_URL=… ./scripts/supabase-bootstrap.sh`; créer ensuite le propriétaire et l'espace public, puis seulement charger éventuellement `store_catalogue.sql`.
- La migration est additive : aucune suppression/renumérotation. Elle doit être déployée avant de compter sur l'unicité en production.
- Le test SQL ne simule pas cinq JWT utilisateurs : il contrôle de façon reproductible la présence et la forme des policies/RPC/triggers ainsi que l'intégrité réelle des rattachements. Une campagne dynamique propriétaire/admin/membre/lecteur/étranger reste souhaitable en préproduction, mais n'est pas nécessaire pour réimplémenter Step 6B.

### Commandes et tests réellement exécutés

- Lecture : `cat ai/CODEX/JOURNAL.md`, `git status --short --branch`, `git log`, `git log --follow` sur les SQL, recherches `rg` et lectures ciblées des sources/tests/SQL.
- `npm test -- --run tests/supabase.test.js tests/core.test.js tests/lib.test.js` : réussi, 3 fichiers et 62 tests.
- `bash -n scripts/supabase-bootstrap.sh` : réussi après correction d'une apostrophe qui cassait initialement l'analyse syntaxique du shell.
- `npm run check` : réussi ; 4 fichiers Vitest et 70 tests, build Vite réussi (338 modules), bundle initial 406,82 kB. Oxlint conserve les 54 avertissements historiques et aucune erreur.
- `npm run test:e2e -- --max-failures=1` : non exécutable ; 1 échec de lancement, 25 tests non lancés, car Chromium Playwright build 1194 est absent. Le téléchargement avait déjà été refusé en HTTP 403 pendant l'audit initial.
- `git diff --check` : réussi.
- `supabase/tests/pareto_v1.sql` et le bootstrap réel : non exécutés, car ce conteneur ne fournit ni `psql`, ni CLI Supabase, ni base configurée. Aucun résultat historique n'est présenté comme un résultat de cette session.

### Bugs découverts et corrigés

- Reconstruction neuve impossible par simple ordre naïf à cause de la dépendance circulaire autour de `private.mfa_ok()` : corrigée par une amorce minimale versionnée.
- Concurrence possible sur les numéros devis/factures : corrigée en base par index unique forward, avec diagnostic préalable et message UI compréhensible.
- `peutGerer` maintenait une logique parallèle à la matrice de permissions : corrigé en le dérivant de `settings.edit`.
- Documentation racine indiquait encore Netlify et `schema.sql` seul : corrigée vers Cloudflare Pages et la procédure Supabase complète.

### Problèmes volontairement reportés

- Calculs et chargement total côté navigateur (étape 5) : risque de montée en charge, pas bloquant pour le démarrage V1 au volume actuel.
- Paiements/dépenses comme `actions`, abonnements en JSON, modules Projets/Vie perso : refonte métier hors Pareto V1.
- 54 avertissements oxlint, index faibles non critiques et nettoyage esthétique : aucun impact critique démontré sur le parcours quotidien.
- Corbeille et date de sauvegarde locales, reçus Storage non partagés : documentés ; imposer une sauvegarde régulière et éviter de changer d'appareil pour restaurer.
- Test dynamique SQL avec cinq sessions/JWT et E2E navigateur : à exécuter dès qu'une préproduction et Chromium sont disponibles.

### Risques restants et précautions

- La vraie base n'a pas été interrogée ici. **Avant usage réel**, sauvegarder, appliquer la migration puis obtenir le message de conformité de `pareto_v1.sql`.
- Activer TOTP sur les comptes réels et vérifier au moins manuellement propriétaire/admin/membre/lecteur sur une préproduction.
- Sur une collision de numéro créée hors ligne, la base refusera la synchronisation et conservera l'opération en file ; choisir un nouveau numéro depuis un état synchronisé. Ce comportement protège l'intégrité mais demande une intervention utilisateur.
- Faire une sauvegarde JSON au minimum chaque semaine ; la corbeille n'est pas serveur.

### État de la V1

**🟠 V1 EXPLOITABLE AVEC PRÉCAUTIONS.** Le parcours métier principal et ses calculs sont couverts, le risque de doublons est traité dans le dépôt et le chemin Supabase est reproductible. L'usage quotidien peut commencer après sauvegarde, déploiement de la migration unique et réussite du contrôle SQL sur la base réelle. En l'absence de ces trois actions, l'état distant reste non vérifié.

### Prochaine action

1. Sur une préproduction puis la production sauvegardée : diagnostic doublons, migration `20260930180000…`, `pareto_v1.sql` et test manuel des quatre rôles.
2. Installer Chromium dans la CI/l'environnement autorisé et exécuter les 26 parcours Playwright complets.
3. Après quelques semaines de données réelles, mesurer le volume/temps de chargement avant de décider du périmètre minimal de l'étape 5.

### À transmettre à Claude

- Le socle historique n'a pas été réécrit : son ordre est `supabase/migrations/legacy-order.txt`; `owner.sql`, `demo.sql` et `store_catalogue.sql` sont volontairement exclus pour les raisons documentées.
- Pour une base vide, utiliser uniquement `scripts/supabase-bootstrap.sh`; il refuse une base initialisée. `bootstrap_prerequis.sql` est nécessaire au cycle 2FA site/store et sera ensuite remplacé à l'identique par `double_auth.sql`.
- Pour la base actuelle, ne pas rejouer le socle : sauvegarder, vérifier les doublons, appliquer seulement `20260930180000_pareto_v1_documents_uniques.sql`, puis lancer `supabase/tests/pareto_v1.sql`.
- L'index unique est par `workspace_id + type + lower(trim(numero))` et seulement pour `devis`/`facture`. Ne pas supprimer ou renuméroter automatiquement d'éventuels doublons historiques.
- Step 6A/6B n'a pas été reconstruit. Le contrôle SQL protège leurs invariants structuraux ; la règle espace + adhésion + rôle reste impérative et aucune policy `own …` métier ne doit revenir.
- `peutGerer` utilise désormais `settings.edit`; `security.manage` reste exclu pour admin comme auparavant. Tests JS : 70 verts via `npm run check`.
- Les SQL n'ont pas été exécutés contre Supabase pendant cette session et les E2E n'ont pas démarré faute de Chromium. Vérifier ces deux points avant de promouvoir la V1 au statut vert.

---

## 2026-09-30 — Validation finale Pareto V1

### Objectif

Déterminer honnêtement si la V1 peut passer de 🟠 à 🟢 en exécutant les validations Supabase et navigateur disponibles, sans nouvelle fonctionnalité et sans toucher à une base de production non identifiée.

### Environnement disponible

- Dépôt propre au départ, branche `work`, HEAD observé `feed454` (contenu du commit Pareto V1 demandé, réidentifié par l'environnement).
- Aucun remote Git configuré.
- Aucun `psql`, CLI Supabase, Docker, Podman, Chromium ou Chrome installé.
- Aucune variable `DATABASE_URL`, `SUPABASE_DB_URL`, `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY`; seul `.env.example` existe.
- Il est donc impossible d'identifier une base locale, de préproduction ou de production. Conformément à la règle de sécurité, aucune connexion ni migration distante n'a été tentée.
- Une tentative raisonnable d'obtenir les paquets système (`apt-get update -qq`) a atteint tous les dépôts via le proxy mais a reçu HTTP 403. Aucun contournement supplémentaire n'a été tenté.

### Diagnostic Supabase avant migration

Le contrôle final `pareto_v1.sql` préparé précédemment s'exécute après migration et exige déjà l'index. Pour rendre la séquence demandée explicite et sûre, ajout de `supabase/tests/diagnostic_avant_migration.sql`, strictement en lecture seule. Il produit successivement :

1. les doublons de numéros de devis/factures par espace et type, avec les identifiants concernés ;
2. les tables contenant des lignes sans `workspace_id` ;
3. les actions/documents reliés à un prospect d'un autre espace ;
4. les espaces dont le propriétaire n'a pas exactement une adhésion `proprietaire` ;
5. les anciennes policies métier `own …` interdites ;
6. l'inventaire des policies réellement installées sur les tables critiques.

Les cinq premiers résultats doivent être vides avant migration. Aucun résultat réel n'est disponible pendant cette session, faute d'accès à une base.

### Migrations et état Supabase

- `20260930180000_pareto_v1_documents_uniques.sql` : **non exécutée**.
- `supabase/tests/diagnostic_avant_migration.sql` : **non exécuté contre PostgreSQL**.
- `supabase/tests/pareto_v1.sql` : **non exécuté contre PostgreSQL**.
- Tests dynamiques propriétaire/admin/membre/lecteur/utilisateur extérieur : **non exécutés**, car ils nécessitent une base de test identifiée et des sessions/JWT distincts.
- Aucune donnée, policy, fonction, adhésion ou migration de production n'a été modifiée.

### Validation navigateur et parcours métier

- Recherche de navigateurs dans le cache Playwright, `/usr/bin`, `/usr/local/bin` et `/opt` : aucun exécutable compatible trouvé.
- `apt-get update -qq` : dépôts Ubuntu, LLVM et mise refusés par le proxy en HTTP 403 ; installation raisonnable de Chromium impossible.
- `npm run test:e2e -- --max-failures=1` : Playwright a découvert 26 tests, mais le premier n'a pas démarré car `chromium_headless_shell-1194` est absent ; arrêt volontaire après cet unique échec d'environnement, 25 tests non exécutés.
- Authentification, changement d'espace, déconnexion/reconnexion, refus RLS et parcours métier dans un vrai navigateur n'ont donc pas été revalidés ici. Le test métier intégré JavaScript de la mission précédente reste vert aujourd'hui via `npm run check`, mais il ne remplace pas un E2E.

### Corrections effectuées

- Ajout du diagnostic pré-migration séparé afin qu'aucune migration ne soit lancée avant la vérification des doublons, rattachements, propriétaires et policies.
- Mise à jour de `supabase/README.md` : exécuter d'abord les cinq diagnostics, conserver l'inventaire des policies, puis seulement appliquer la migration si les résultats sont vides.
- Extension de `tests/supabase.test.js` pour garantir que le diagnostic versionné continue de couvrir les cinq familles d'anomalies critiques.
- Aucune correction applicative : aucun bug critique réel n'a pu être reproduit dans les tests exécutables.

### Fichiers modifiés

- Créé : `supabase/tests/diagnostic_avant_migration.sql`.
- Modifiés : `supabase/README.md`, `tests/supabase.test.js`, `ai/CODEX/JOURNAL.md`.
- Aucune migration existante ni donnée applicative modifiée.

### Commandes et résultats réels

- `cat ai/CODEX/JOURNAL.md`, `git status --short --branch`, `git log --oneline -5` : journal relu, état initial propre.
- Détection via `command -v`, `find`, présence des variables sans afficher de secret : aucun outil/base/navigateur disponible.
- `apt-get update -qq` : terminé avec avertissements HTTP 403 pour tous les dépôts ; aucun paquet actualisé utilisable.
- `npm run check` : **réussi** ; 4 fichiers Vitest, 70 tests réussis, build Vite réussi (338 modules), aucune erreur oxlint et 54 avertissements historiques.
- `npm run test:e2e -- --max-failures=1` : **bloqué par l'environnement** ; 1 échec de lancement pour Chromium absent, 25 tests non exécutés.
- Aucun SQL n'a été présenté comme exécuté.

### Action requise du propriétaire du projet

Pour lever le blocage sans risque, fournir soit une base Supabase locale/préproduction jetable avec son `DATABASE_URL`, soit exécuter soi-même dans le SQL Editor de la base sauvegardée, dans cet ordre :

1. effectuer/valider une sauvegarde récupérable ;
2. exécuter `supabase/tests/diagnostic_avant_migration.sql` et conserver les six résultats ;
3. si l'un des cinq premiers résultats contient une ligne, ne pas migrer et transmettre les résultats (sans secrets) pour proposer une correction ciblée ;
4. si les cinq résultats sont vides, appliquer `supabase/migrations/20260930180000_pareto_v1_documents_uniques.sql` ;
5. exécuter `supabase/tests/pareto_v1.sql` et vérifier le message `Pareto V1 : invariants critiques conformes` ;
6. sur une préproduction, tester réellement les cinq profils et transmettre les résultats ; ne pas communiquer de mots de passe ou clés secrètes dans Git.

### Limitations et risques restants

- État réel de la base, présence de doublons, intégrité `workspace_id`, policies déployées et application de la migration restent inconnus.
- Aucun comportement RLS n'a été exercé avec de vrais JWT aujourd'hui.
- Aucun parcours Playwright n'a été exécuté aujourd'hui.
- Ces validations sont précisément les critères qui empêchent un passage responsable au vert ; les tests JavaScript seuls ne suffisent pas.

### Décision finale

**🟠 V1 EXPLOITABLE AVEC PRÉCAUTIONS.** Aucun nouveau défaut critique n'a été découvert dans les contrôles exécutables, mais Supabase et Playwright restent non validés dans l'environnement réel. Le statut ne peut pas passer à 🟢 avant diagnostic/migration/contrôle SQL sur une base sauvegardée et au minimum une campagne E2E dans un environnement disposant de Chromium.

### À transmettre à Claude

- Codex a réellement exécuté `npm run check` : 70 tests verts et build vert. Aucun SQL n'a été exécuté.
- La migration d'unicité n'a pas été appliquée et l'état de la base distante n'a pas été lu, car aucune URL/CLI/`psql` n'était disponible.
- `supabase/tests/diagnostic_avant_migration.sql` est nouveau : il doit impérativement précéder la migration et ses cinq premiers résultats doivent être vides.
- Le contrôle post-migration reste `supabase/tests/pareto_v1.sql`. Ne déclarer ni migration ni Step 6B validé aujourd'hui sans ses résultats réels.
- Playwright a trouvé 26 tests mais aucun parcours n'a démarré : Chromium manque et le proxy bloque les dépôts apt en HTTP 403.
- Aucun changement applicatif ni donnée de production. Statut maintenu 🟠 pour absence de preuves Supabase/E2E, pas pour un échec fonctionnel démontré.
- Pour reprendre : obtenir une préproduction/URL PostgreSQL non productive ou les six sorties du diagnostic exécuté par le propriétaire, puis seulement décider d'appliquer la migration et de tester les rôles.

---

## Nettoyage repository — Cloudflare comme référence

### Mission

Nettoyer le dépôt sans refonte fonctionnelle, supprimer les éléments actifs de l'ancien hébergeur, faire de Cloudflare Pages l'unique référence de déploiement et classer prudemment les autres éléments suspects.

### État initial et analyse

- Journal relu intégralement ; arbre Git propre au départ ; HEAD `0e29dfe`.
- Recherche sur tous les fichiers suivis : l'ancien hébergeur apparaissait encore dans `netlify.toml`, `README.md`, `docs/DECISIONS.md`, `docs/KNOWN_ISSUES.md` et dans les anciennes entrées immuables de ce journal.
- `netlify.toml` ne contenait que `npm run build`, la publication de `dist` et `Cache-Control: no-cache` pour `sw.js`. La commande/sortie sont désormais documentées pour Cloudflare ; la règle de cache existe déjà dans `public/_headers`, copié par Vite vers `dist/_headers`. Le fichier n'avait donc plus aucun rôle.
- Vérification Cloudflare : `npm run build` produit le CRM dans `dist`, le site intégré dans `dist/site`, `dist/_headers`, le manifeste et un `sw.js` dont la version et les assets sont injectés par `vite.config.js`. Le routage CRM utilise `/#/…`, donc aucune réécriture SPA n'est requise.
- Audit des dépendances : toutes les dépendances runtime sont importées ; Playwright/axe/Vite/Vitest/oxlint/plugin React sont utilisés par les tests, la CI ou la configuration. Les paquets `@types/react*` restent utiles à l'éditeur et au typage JSX. Aucune dépendance propre à l'ancien hébergeur n'existait.
- Audit organisationnel : aucun artefact de build/test n'est suivi (`dist`, `dist-e2e`, `test-results`, `node_modules` sont ignorés). Les doublons binaires favicon/apple-touch-icon sont intentionnels : `public/` et `site/assets/` sont deux racines de build indépendantes.

### Classement et décisions

#### A — Supprimable sans risque

- Configuration racine de l'ancien hébergeur : supprimée après confirmation que `public/_headers` porte la seule règle encore utile.
- `supabase/owner.sql` : supprimé. Ce script codait deux e-mails en dur, était explicitement remplacé par `supabase/espaces.sql`, exclu du bootstrap et dangereux à rejouer.
- Fonction locale `fcfa` inutilisée dans `site/build.mjs` : supprimée ; aucun appel n'existait.
- Mentions actives/périmées de l'ancien hébergeur dans README et docs opérationnelles : supprimées ou reformulées vers Cloudflare.

#### B — À déplacer/organiser

- Aucun déplacement : les frontières existantes (`src`, `site`, `supabase`, `tests`, `e2e`, `scripts`, `docs`, `ai`) sont déjà simples et comprises par les scripts/imports. Déplacer des fichiers n'aurait apporté aucun gain proportionné au risque.
- Le README reçoit une carte courte de cette structure plutôt qu'une réorganisation artificielle.

#### C — Conservé volontairement

- `supabase/demo.sql` : destructif mais utile et clairement limité au compte de démonstration ; exclu du bootstrap.
- `supabase/store_catalogue.sql` : seed facultatif nécessaire à l'Elite Store ; exclu du bootstrap tant que l'espace public n'existe pas.
- SQL historiques à la racine de `supabase/` : conservés car le bootstrap canonique les applique dans un ordre versionné et les bases existantes les ont reçus successivement.
- `public/template/Agence_Elite_Pilotage.xlsx` : modèle réel utilisé par l'import/export, pas un fichier temporaire.
- Images identiques entre `public/` et `site/assets/img/` : conservées pour leurs sorties indépendantes.
- Références au nom de l'ancien hébergeur dans les entrées précédentes de `ai/CODEX/JOURNAL.md` : conservées uniquement comme historique immuable, conformément à la règle « ne jamais remplacer les anciennes entrées ». Aucune référence active ne subsiste hors journal.

### Éléments supprimés et documentation corrigée

- Supprimés : `netlify.toml`, `supabase/owner.sql`, constante inutilisée `fcfa`.
- `README.md` : repository officiel `justegladerara-cpu/agence-elite-crm`, connexion GitHub → Cloudflare Pages, branche choisie dans Cloudflare, build `npm run build`, sortie `dist`, variables Supabase, domaine, routage hash, `_headers`, PWA/service worker, site `dist/site`, structure du dépôt.
- `docs/PROJECT_CONTEXT.md` : suppression des anciennes instructions de branches/push spécifiques ; Cloudflare officiel et réglages de build exacts.
- `docs/DECISIONS.md` : décision reformulée autour de Cloudflare officiel sans conserver d'instruction obsolète.
- `docs/KNOWN_ISSUES.md` : retrait du problème résolu concernant l'ancien fichier de configuration.
- `supabase/README.md`, `legacy-order.txt`, `tests/supabase.test.js` : suppression propre de la référence au fichier `owner.sql`, conservation de l'explication historique et garde-fou empêchant son retour.
- Aucun paramètre Cloudflare distant, DNS, secret, utilisateur ou donnée Supabase modifié.

### Configuration Cloudflare vérifiée dans le dépôt

- Source GitHub officielle documentée : `justegladerara-cpu/agence-elite-crm`.
- Commande : `npm run build`.
- Sortie : `dist` ; site public intégré : `dist/site`.
- Variables : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Domaine documenté : `crm.agence-elite.fr`.
- SPA : routes hash, pas de `_redirects` nécessaire.
- PWA : manifeste + service worker généré/versionné ; `_headers` Cloudflare impose `no-cache` à `/sw.js`.
- Limite : la branche de production, le projet Pages, le domaine et les variables distantes ne sont pas vérifiables depuis ce checkout sans remote/configuration Cloudflare ; le README demande donc explicitement de choisir la branche dans le tableau de bord.

### Tests et commandes exécutés

- `git grep -n -i 'netlify'` et recherches ciblées de configuration : après nettoyage, zéro référence active hors anciennes entrées du journal.
- Inventaire `git ls-files`, `find`, recherche de fichiers temporaires, hashes identiques et usages des dépendances/imports : aucun autre élément A identifié.
- `npm ls --depth=0` : réussi, arbre de dépendances installé cohérent, aucune dépendance manquante signalée.
- `npm run build` pendant l'audit : réussi, 338 modules et 19 pages statiques ; présence vérifiée de `dist/_headers`, `dist/sw.js`, manifeste et `dist/site/404.html`.
- `npm run check` après nettoyage : réussi ; 4 fichiers Vitest, 70 tests, build réussi, 338 modules.
- `npm run lint` : réussi avec 49 avertissements existants, 0 erreur. Le retrait de `fcfa` supprime un avertissement de code mort.
- `npm run test:e2e -- --list` : réussi ; les 26 tests Playwright sont découverts (13 ordinateur, 13 téléphone), ce qui valide configuration et imports. Exécution navigateur non relancée : Chromium reste absent comme documenté à l'entrée précédente.
- `git diff --check` : réussi.

### Structure après nettoyage

```text
.github/workflows/  CI
ai/CODEX/           mémoire IA
public/             assets CRM, PWA et _headers Cloudflare
scripts/            opérations contrôlées
site/               générateur du site public intégré
src/                application, core, modules, pages, bibliothèques
docs/               architecture, décisions, contexte
supabase/           SQL, migrations, fonctions, tests et guide
tests/              Vitest
e2e/                Playwright
```

### Risques et éléments non vérifiables

- La configuration distante Cloudflare Pages n'est pas accessible ici : vérifier dans Cloudflare que le repository, la branche, les deux variables et le domaine correspondent au README.
- Les anciennes entrées du journal contiennent encore le mot `Netlify` comme preuve historique ; elles ne sont ni une instruction ni une configuration active.
- Les avertissements lint restants et les éléments classés C ne sont pas de la dette morte prouvée ; ils n'ont pas été supprimés par prudence.

### État final

Le repository est cohérent pour poursuivre le développement : Cloudflare Pages est l'unique plateforme active documentée, l'ancienne configuration a disparu, aucune dépendance associée n'existait, les chemins de build/PWA/site sont vérifiés et aucune réorganisation risquée n'a été introduite.

## À transmettre à Claude

- Ne recrée pas `netlify.toml` : `public/_headers` est la configuration Cloudflare utile pour le service worker, et README contient le build/sortie.
- `supabase/owner.sql` a été supprimé intentionnellement ; `espaces.sql` et les inscriptions/invitations privées sont la source actuelle. L'ancien fichier reste dans Git si audit nécessaire.
- Le déploiement officiel est GitHub `justegladerara-cpu/agence-elite-crm` → Cloudflare Pages, `npm run build` → `dist`, domaine `crm.agence-elite.fr`. La branche distante doit être vérifiée dans Cloudflare.
- Aucune dépendance npm retirée : toutes ont un usage confirmé ou un rôle outillage/éditeur. Aucun fichier déplacé.
- Tests réels : `npm run check` vert (70), build vert, `npm ls --depth=0` vert, 26 tests E2E listés mais non exécutés faute de Chromium.
- Toute occurrence `Netlify` restante est confinée aux anciennes entrées immuables de ce journal ; hors journal, la recherche Git doit rester vide.

---
