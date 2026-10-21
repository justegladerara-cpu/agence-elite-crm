# Journal SUPERADMIN 2.0

Point de reprise de la mission. Une section par lot : fait, décisions, bloqué, prochaine étape.
Branches : `claude/superadmin-v2-lot-0` … `lot-7`, chacune partant de la précédente, une PR brouillon par lot.
La production (`claude/project-thread-j6wx9s`) n'est jamais touchée sans accord écrit de Juste.

---

## Lot 0 — État des lieux et mesures de départ (2026-10-21)

### État constaté
- Production `origin/claude/project-thread-j6wx9s` = `ef4ac25` (fusion PR #20), **identique au commit de l'audit** : aucun
  commit ajouté depuis, inventaires inchangés.
- PR ouvertes CRM : #19 (brouillon, double authentification interne).
- PR ouvertes plateforme : #71 « Super Admin retiré du SaaS » (**ouverte, non fusionnée**, fusionnable, dernière mise à
  jour 2026-10-19), #70 (brouillon, MFA), #66 (Analyses des ventes). `main` plateforme = `6c04e59` (PR #69).
- Tests de départ : `npm ci` OK, `vitest` 127/127, build OK, e2e : voir `10_PERFORMANCE.md`.
- Base CRM de production, **lecture seule** (SEC-08) : la migration `20260930180000_pareto_v1_documents_uniques.sql`
  n'est **pas** appliquée (absente de l'historique, index unique absent de `public.documents`). Aujourd'hui : 0 doublon
  de numéro, 0 paiement orphelin, 97 paiements liés à une facture par son numéro.

### Fait
- `scripts/plateforme-fictive/` : base plateforme **fictive** (PGlite) qui rejoue les 97 vraies migrations du dépôt
  plateforme (instantané versionné `instantane/`, commit `6c04e59`) + ses données de démonstration + 5 clients fictifs
  créés par les vraies fonctions (licence échue, à renouveler sous 7 j, active, suspendue, client bloqué). Serveur
  local qui imite Supabase (Auth + RPC + lectures), avec routes de test (`/__journal`, `/__reinitialiser`, `/__panne`).
- **Aperçu sûr** (`scripts/apercu.mjs`, `vite.config.js`, `site/build.mjs`) : tout build Cloudflare qui n'est pas la
  production (`CF_PAGES_BRANCH` ≠ `claude/project-thread-j6wx9s` / `site`) passe en mode démo : variables Supabase
  ignorées, plateforme fictive seulement, et une politique CSP `connect-src` interdit au navigateur toute autre
  connexion. Le site vitrine de l'aperçu ne parle plus à la base.
- En mode démo, le CRM ne vise plus la plateforme de production par défaut (`src/lib/porte.js`) ; garde-fou réseau
  `src/lib/gardeReseau.js` posé avant tout le reste.
- `scripts/mesure/` : prévisualisation locale, mesures (boutons, champs, débordements, onglets coupés, erreurs,
  requêtes vers la production), tailles du build, résumé avant/après. Mesures de départ : `mesures/avant.json`,
  76 captures `CAPTURES/avant/`.
- Lint : règle `no-undef` ajoutée (en avertissement au lot 0, en erreur au lot 1). Elle trouve SEC-07.

### Décisions (option la plus sûre)
- **D0-1** Audit absent : chiffres de départ remesurés par nos scripts, identifiants propres à la mission ; rapprochement
  à faire quand l'audit sera déposé.
- **D0-2** Maquette absente : design fondé sur les tokens du § 9 uniquement, aucun contenu de maquette inventé.
- **D0-3** Un aperçu de branche est **toujours** en mode démo, même si Cloudflare lui donne les variables de production.
- **D0-4** La plateforme fictive vit dans ce dépôt (instantané) pour que la CI et l'aperçu en ligne n'aient pas besoin
  du dépôt plateforme (privé).
- **D0-5** Les messages console « Failed to load resource » viennent d'images en ligne bloquées par le bac à sable :
  comptés à part des erreurs JavaScript.

### Bloqué
- **Bloqué : audit absent** (`/mnt/project-files/crm/audit-superadmin-2026-10-21/` n'existe pas).
- **Bloqué : maquette absente** (`/mnt/project-files/crm/superadmin-v2/maquette*.png`).

### Prochaine étape
Lot 1 : sécurité SEC-01 à SEC-15, composant unique de zone danger.

---

## Lot 1 — Sécurité (2026-10-21)

### Fait
- SEC-01 à SEC-15 corrigés côté CRM, un test de non-régression par point : `tests/securite.test.js` (21 tests) et
  `e2e/securite.spec.js` (8 parcours × 2 formats, plateforme fictive). Détail : `07_SECURITY_REGISTER.md`.
- Composant unique de zone danger (`confirmer` / `DangerAction`, `src/ui.jsx`) ; pile unique des fenêtres
  (`src/lib/couches.js`) : Échap ne ferme que la fenêtre du dessus, dans le CRM et les écrans éditeur.
- Encaissement suivi pas à pas (`modules/plateforme/operations.js`), écran « Opérations à réconcilier » sur la Tour de
  contrôle et la fiche client, journal des gestes avec motif.
- Import « Remplacer » sans état vide, restauration d'une sauvegarde, exports CSV neutralisés et réservés
  propriétaire/admin, avertissement données personnelles.
- `no-undef` en erreur. Bouton éditeur : `disabled` passé par l'appelant n'annule plus le blocage pendant l'envoi.
- Vérification SQL des deux dépôts (`scripts/audit-sql/fonctions-ecriture.py`) : aucune fonction d'écriture exposée sans
  contrôle ; `*_pages_auth` contrôlées via `cible_pages_auth`.
- Résultats : oxlint 0 erreur, vitest 152/152, build OK (index 416 ko < 700 ko), Playwright 49 réussis + 1 sauté
  (raccourcis clavier sur téléphone, déjà le cas sur `ef4ac25`).
- Un e2e a attrapé une erreur introduite pendant le lot (variable lue avant sa déclaration dans `Factures.jsx`),
  corrigée avant le commit.

### Décisions (option la plus sûre)
- **D1-1** Idempotence de l'encaissement sans nouvelle fonction SQL : la référence `OP-…` est cherchée dans
  `editeur_etablissement.historique_licences` avant de renouveler. Limite connue : deux onglets au même instant.
  Clé unique côté base à proposer en PR plateforme non appliquée (lot 5).
- **D1-2** Le motif des gestes sans paramètre motif côté base (statut client/établissement, modules) est gardé dans le
  journal des gestes du CRM (sur l'appareil). Pas de SQL plateforme au lot 1.
- **D1-3** Écran éditeur « Renouveler » : le montant est retiré plutôt que doublé d'une écriture CRM, pour qu'il n'existe
  qu'un chemin d'encaissement (la fiche client).
- **D1-4** SEC-14 : SQL proposé, non appliqué. Conséquence à valider : les comptes Elite Emploi devront confirmer leur
  e-mail.
- **D1-5** L'audit du 2026-10-19 (seul audit présent) utilise une autre numérotation : correspondances notées dans le
  registre, sans renuméroter.

### Bloqué / en attente d'accord écrit
- Index unique des numéros de documents (`20260930180000_pareto_v1_documents_uniques.sql`) : migration CRM de production.
- SEC-14 (`docs/superadmin-v2/migrations-proposees/SEC-14_inscriptions_emploi.sql`) : migration CRM de production.

### Prochaine étape
Lot 2 : navigation en 6 espaces (une seule liste pour menu, Ctrl K et titres mobiles), redirections des anciennes routes.
