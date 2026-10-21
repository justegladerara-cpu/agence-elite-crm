# Registre de sécurité — SUPERADMIN 2.0 (lot 1)

Référence : production `ef4ac25`. L'audit du 2026-10-21 n'a pas été déposé (voir JOURNAL, D0-1) : les identifiants
SEC-01 à SEC-15 ci-dessous sont **ceux de la mission**, tirés de la relecture du code et des mesures du lot 0.
La dernière colonne renvoie, quand il existe, au point équivalent de l'audit du 2026-10-19
(`/mnt/project-files/audit/AUDIT-SAAS-CRM-2026-10-19.md`, numérotation différente).

Méthode pour chaque point : reproduire par un test qui échoue sur `ef4ac25`, corriger, garder le test comme test de
non-régression. Tests : `tests/securite.test.js` (règles) et `e2e/securite.spec.js` (parcours, plateforme fictive).
Aucun appel à la plateforme de production, aucune vraie session super admin, aucune donnée réelle.

Reproduction sur `ef4ac25` (worktree de référence) : `nextNumero(…, ['FAC-2026000007'])` rend `FAC-2026000001`
(attendu `…008`) ; `refusDe('membre', 'exporter')` rend `null` (attendu un refus). Les autres tests échouent sur
`ef4ac25` parce que la protection n'existait pas (module ou fonction absente) : ils documentent le comportement exigé.

| ID | Gravité | Constat sur `ef4ac25` | Correction (lot 1) | Test de non-régression | État | Audit 10-19 |
|---|---|---|---|---|---|---|
| SEC-01 | Élevée | Supprimer une facture : aucune confirmation ; quand une ligne de suivi était liée, la seule question portait sur cette ligne et **les deux réponses supprimaient la facture** ; le numéro d'une facture supprimée pouvait être redonné. | Une seule fenêtre de zone danger (objet, effet, case « supprimer aussi la ligne », décochée) ; numéros cités par un paiement ou dans la corbeille jamais redonnés (`numerosDejaPris`). | `securite.test.js` › SEC-01/08 ; e2e `parcours` › numéro déjà utilisé | Corrigé | — |
| SEC-02 | Critique | Import Excel « Remplacer » : `wipe()` effaçait **tout l'espace** avant d'importer ; un import en échec laissait le CRM vide. | Sauvegarde téléchargée d'abord, confirmation tapée `REMPLACER`, ajout d'abord puis retrait des anciennes lignes **par identifiant** ; échec = retrait de ce qui vient d'être ajouté ; anciennes lignes dans la corbeille. `wipe()` supprimé du store. | `securite.test.js` › SEC-02 (3 tests) | Corrigé | — |
| SEC-03 | Élevée | « Encaisser » : renouvellement plateforme puis paiement CRM sans suivi ni idempotence ; réponse perdue → 2e prolongation possible, paiement oublié. | Opération suivie pas à pas (`modules/plateforme/operations.js`) : préparée → licence faite → paiement fait → terminée / partielle / à réconcilier / échouée ; l'id `OP-…` est la référence du renouvellement **et** est écrit dans le paiement ; avant chaque étape on vérifie si elle est déjà faite ; écran « Opérations à réconcilier » (Reprendre / Marquer comme réglée avec motif) ; récapitulatif avant envoi ; bouton verrouillé pendant l'envoi. | `securite.test.js` › SEC-03 (6 tests) ; e2e › réponse perdue, double clic | Corrigé côté CRM. Reste : deux onglets qui confirment **au même instant** pourraient encore doubler (vérification puis écriture non atomique). Clé d'idempotence unique côté base proposée au lot 5 par PR plateforme non appliquée. | SEC-04 |
| SEC-04 | Moyenne | Écran éditeur « Renouveler » : un montant encaissé était inscrit sur la plateforme **sans** paiement dans le CRM (finances fausses). | Devenu « Renouveler sans encaissement » : pas de montant, motif obligatoire, date après l'échéance ; lien « Encaisser et renouveler » vers la fiche CRM. | e2e › SEC-04 | Corrigé | — |
| SEC-05 | Moyenne | Gestes sensibles en un clic : module activé/retiré, statut d'établissement, rôle Admin Agence Elite, retour à l'identité d'origine (effacement immédiat). | Confirmation de zone danger avec objet, effet et **motif** (obligatoire pour retirer / bloquer / donner un rôle / effacer l'identité) ; motif noté dans le journal des gestes. | e2e › SEC-05 (motif, Échap) | Corrigé. Le motif n'est pas stocké dans la base plateforme pour les fonctions qui n'ont pas de paramètre motif (proposition au lot 5). | — |
| SEC-06 | Élevée | « Se déconnecter » du CRM laissait la porte super admin ouverte 12 h et la session plateforme dans le navigateur. | `quitter()` ferme la porte, déconnecte la plateforme puis le CRM ; au démarrage la session plateforme est revérifiée à chaque ouverture (la porte de 12 h ne sert plus que hors ligne). | `porte.test.js` (existant) + revue | Corrigé. Le jeton plateforme reste dans le `localStorage` tant que la session est ouverte (voir « Hors périmètre »). | SEC-02 (partiel) |
| SEC-07 | Moyenne | Onglet Assistance de l'éditeur : « Fermer » appelait `rechargerContexte()` qui n'existe pas → erreur JS, session non rafraîchie. | Appel retiré (le rechargement est déjà fait par `useAction`) ; règle lint `no-undef` passée en **erreur**. | `npx oxlint` (0 erreur) | Corrigé | — |
| SEC-08 | Moyenne | Le numéro d'une facture payée restait modifiable ; une facture payée pouvait être supprimée (paiements orphelins). Index unique `pareto_v1` absent en production (lecture seule, 0 doublon aujourd'hui). | Numéro figé dès qu'un paiement cite la facture ; suppression refusée (il faut l'annuler). Index : migration déjà dans le dépôt, **non appliquée** (accord écrit requis). | `securite.test.js` › SEC-01/08 | Corrigé côté CRM. Base : en attente d'accord. | — |
| SEC-09 | Moyenne | « Prolonger » acceptait une date à partir d'aujourd'hui même si l'échéance était plus loin (la base refusait ensuite) ; aucun motif. | Règles d'échéance partagées (`modules/plateforme/licence.js`, identiques à `renouveler_licence`) : minimum = lendemain de l'échéance, motif obligatoire, récapitulatif « avant → après ». | `securite.test.js` › SEC-09 ; e2e › SEC-09 | Corrigé | — |
| SEC-10 | Moyenne | Rôles CRM : l'interface montrait à un lecteur ou un membre des gestes que la base refuse (erreur après coup). | Lecteur : boutons d'écriture masqués (`.ecriture`), saisie rapide et saisie d'argent refusées avec un message ; « Remplacer » et restauration réservés propriétaire/admin ; export réservé propriétaire/admin. | `securite.test.js` › SEC-10, SEC-12 | Corrigé (masquage étendu aux nouveaux écrans des lots 2 à 6). | — |
| SEC-11 | Moyenne | Sauvegarde JSON téléchargeable mais **aucun moyen de la restaurer**. | « Restaurer une sauvegarde » (Paramètres › Sécurité) : fichier vérifié, confirmation avec le contenu, remise des lignes avec leurs identifiants, rien n'est effacé. | `securite.test.js` › SEC-11 ; e2e › 2 parcours | Corrigé | — |
| SEC-12 | Moyenne | Exports CSV sans neutralisation : une cellule `=…`, `+…`, `@…` devient une formule dans Excel. | `lib/csv.js` (apostrophe devant `= + - @ tab CR`, sauf nombres purs) utilisé par tous les exports CSV (prospects, cockpit, tableaux éditeur). | `securite.test.js` › SEC-12/13 | Corrigé | — |
| SEC-13 | Faible | Exports de données personnelles sans avertissement. | Avertissement avant chaque export (CSV et Excel). | revue + e2e lot 7 | Corrigé | — |
| SEC-14 | Moyenne | Base CRM de production (lecture seule) : `crm_single_owner` confirme d'office l'e-mail de toute inscription `app = emploi`. L'écran de connexion du CRM proposait encore « Première connexion » (inscription). | Écran CRM : inscription retirée. Base : `migrations-proposees/SEC-14_inscriptions_emploi.sql`, **non appliquée** (décision à prendre : les comptes Emploi devront confirmer leur e-mail). | revue | CRM corrigé ; base en attente d'accord. | SEC-06 |
| SEC-15 | Faible | Fiche après appel : les touches 1 à 4 notaient un résultat même pendant une saisie ou avec une touche maintenue. | `estRaccourciLibre` : jamais dans un champ, ni avec Ctrl/Cmd/Alt, ni en répétition. | `securite.test.js` › SEC-15 ; e2e › SEC-15 | Corrigé | — |

## Composant unique de zone danger

`confirmer(message, options)` dans `src/ui.jsx` (rendu par `DangerAction`) : titre, objet rappelé en gras, effet
(`irreversible`, `annulable` ou texte), motif (obligatoire ou facultatif), texte à recopier, cases, action lancée par la
fenêtre (bouton désactivé pendant l'appel, erreur en rouge dans la fenêtre, fermeture seulement après succès).
Échap ne ferme que la fenêtre du dessus (`src/lib/couches.js`, pile unique pour le CRM et les écrans éditeur).

## Journal des gestes

Encaissements, prolongations, blocages, modules, rôles, mots de passe temporaires (jamais le mot de passe lui-même),
identité : `journalOperations()` (`aecrm-operations`, sur l'appareil, 200 dernières entrées). La plateforme garde aussi
sa trace (`journal_audit`, `licence_evenements`).

## Contrôles SQL demandés (`exiger_super_admin` / `est_editeur`)

Script : `scripts/audit-sql/fonctions-ecriture.py <dossier>` (fonctions `security definer` qui écrivent sans appel
visible à un contrôle).
- **Plateforme** (`agence-elite-platform` `main` 6c04e59, 97 migrations) : 43 fonctions sans contrôle visible. 37 ne sont
  pas exposées (déclencheurs, fonctions internes appelées par des fonctions contrôlées). 6 sont exposées :
  `demande_partenaire`, `ouvrir_lien_partage`, `resoudre_connexion` (publiques par conception) et
  `annuler_/remettre_/retourner_contrat_location` (contrôle par `loc_contrat_verrouille(…, 'location.gerer'|'location.louer')`).
  Les fonctions `*_pages_auth` d'écriture **sont contrôlées** : `cible_pages_auth` appelle `exiger_super_admin()` ou
  `exiger_editeur()` avant toute écriture (contrôle indirect, invisible à une simple recherche ; c'est ce que l'audit
  a pris pour une absence).
- **CRM** (`supabase/*.sql`) : 4 fonctions signalées ; `enregistrer_reglages` est contrôlée (`mfa_ok` + `espaces_gestion`),
  `site_contact`, `site_visite`, `store_passer_commande` sont publiques par conception.
- Conclusion : **aucune fonction d'écriture exposée sans contrôle trouvée**. Recommandation (non faite, hors périmètre) :
  ajouter ce script à la CI du dépôt plateforme.

## Hors périmètre du lot 1 (signalé, non corrigé ici)

- MFA du super admin et `aal2` dans `est_super_admin()` : PR #19 (CRM) et #70 (plateforme) déjà ouvertes.
- Jeton plateforme gardé dans le `localStorage` du CRM, en-têtes CSP/HSTS du CRM en production, Elite Emploi sur la même
  origine (audit 10-19 SEC-02) : changement d'architecture (pont serveur) à décider.
- Dépôts publics, sauvegardes GitHub, protection des mots de passe compromis (audit 10-19 SEC-05, SEC-07) : réglages de
  compte, interdits sans accord.
