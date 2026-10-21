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

---

## Lot 2 — Navigation en 6 espaces (2026-10-21)

### Fait
- `src/navigation.js` : liste unique (6 espaces, libellés, raccourcis de filtre, pages rattachées, redirections, barre du
  bas). Menu de gauche, onglets d'espace, recherche Ctrl K, titres sur téléphone et écran « Tous les espaces » la lisent.
- Supprimés comme menus concurrents : boîte à outils (`#/plateforme-outils` → `#/espace/administration`), écran des
  applications (`#/apps` → `#/espace`), barre d'onglets des écrans éditeur. « Déconnecter la plateforme » est passé
  dans l'espace Administration.
- Plus de page orpheline (session, scripts, saisie) ; Tour de contrôle dans la recherche ; titres de Paramètres = libellé
  du menu.
- Tests : `tests/navigation.test.js` (9), `e2e/navigation.spec.js` (5 × 2 formats). Résultats : vitest 161/161,
  Playwright 59 réussis + 1 sauté (le même qu'avant).
- Doc : `01_ARCHITECTURE_V2.md` (principe, dictionnaire des libellés, redirections).

### Décisions
- **D2-1** « Clients du logiciel » (`#/plateforme`) est l'entrée unique ; `editeur/clients` et `editeur/etablissements`
  y sont rattachés en attendant la fiche client unique (lot 5).
- **D2-2** Site web, demandes et Elite Store rangés dans Commercial (ce sont des canaux de vente) ; offres, catalogue et
  identité du logiciel dans Administration (réglages), Hubs et comptes dans Clients logiciel (ils appartiennent aux clients).
- **D2-3** Barre du bas : « Espaces » plutôt que « Plus » pour ne pas se confondre avec les menus « Plus » des pages.
- **D2-4** Les entrées éditeur réservées au super admin (adresses, sites, copie) restent visibles : la page elle-même
  refuse si le compte n'a pas le rôle (le menu ne connaît pas le rôle plateforme avant connexion).

### Prochaine étape
Lot 3 : design clair (jetons du § 9, navigation bleu nuit, contenu clair), écrans éditeur au même style.

---

## Lot 3 — Design SaaS premium (2026-10-21)

### Fait
- `src/saas-premium.css` : interface par défaut, limitée à `:root[data-ui="saas"]`. Jetons du § 9 (nav `#0B1424`,
  nav2 `#13233B`, accent `#2563EB`, fond `#F6F8FC`, surface, texte, bordure, succès, avertissement, erreur), espacements
  4 à 48, contrôles 40 px (44 px au doigt), cibles 44 px, transitions 120–220 ms, `prefers-reduced-motion`, focus visible.
  Les anciennes variables (`--navy`, `--gold`, `--muted`…) sont réassociées : tout l'existant suit sans réécriture.
- Écrans éditeur (`src/saas`, `.saas-admin`) : leurs variables reçoivent les mêmes jetons (même fichier).
- `docs/DESIGN_SYSTEM.md` : nouvelle section 0 (jetons, règles, contrôle), mise à jour dans le même commit.
- Corrections trouvées par le contrôle de toutes les pages : contraste du texte secondaire, lien-bouton illisible
  (Documents), bouton clair devenu foncé (Ma journée), champs sans nom (Textes des scripts), tableaux défilants
  inaccessibles au clavier (8 tableaux), débordement de 2 px à 320 px (Conversion), pages sans titre h1 (Tour de
  contrôle et Clients du logiciel avant connexion, Elite Store en démo).
- `GardeErreur` (`src/ui.jsx`) autour de chaque page et des écrans éditeur : une erreur d'affichage montre
  « Réessayer » au lieu d'un écran blanc (constat du lot 1).
- Tests : `e2e/design.spec.js` (11 tests × 2 formats) : jetons, interfaces au choix, 6 pages × 11 largeurs sans
  défilement horizontal, axe page entière sans violation grave ou critique sur toutes les pages du menu et deux écrans
  éditeur, garde d'erreur. Résultats : oxlint 0 erreur, vitest 161/161, Playwright 83 réussis + 1 sauté (le même).
- JS initial : 417,7 ko (gzip 131,0 ko), sous la mesure du lot 0 (422,0 ko).

### Décisions
- **D3-1** Nouvelle clé de réglage `ui` (défaut `saas`) au lieu de l'ancienne `interface` : beaucoup de réglages ont
  `interface: 'palantir'` enregistré, ils auraient gardé l'ancien design. Salle de contrôle et Classique restent au choix
  (Paramètres › Identité › Interface) : rien n'est supprimé.
- **D3-2** Texte secondaire : le jeton `#64748B` ne donne que 4,47:1 sur le fond `#F6F8FC` (AA exige 4,5:1). Le jeton
  est gardé pour les icônes et traits ; le texte secondaire utilise `#5B6779` (même teinte, 5,4:1). Même règle pour les
  couleurs d'état écrites en texte (vert `#15803D`, orange `#B45309`, rouge `#B91C1C`) ; les jetons purs servent aux fonds
  et pastilles.
- **D3-3** `.btn.primary` et `.btn.gold` sont tous deux bleu accent : l'ancienne distinction marine/or n'a plus de sens
  dans ce design ; la règle « une action principale par zone » est traitée au lot 6 (densité).
- **D3-4** `src/saas/saas.css` (généré) n'est pas modifié : l'alignement passe par les variables, dans `saas-premium.css`.

### Prochaine étape
Lot 4 : tableau de bord unique sur la Tour de contrôle (4 indicateurs, 5 états par bloc, filtre visible, vraie devise).
