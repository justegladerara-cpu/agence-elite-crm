# Double authentification des comptes internes du CRM (2026-10-19, audit SEC-01 / SEC-02 / SEC-09)

**Migration :** `supabase/migrations/20261019040000_mfa_obligatoire_interne.sql` (non destructive, rejouable).

## Ce qui change
- Base : `private.mfa_ok()` garde l'ancienne règle tant que le mode obligatoire est désactivé (aucun verrouillage).
  En mode obligatoire, un compte **interne** (membre d'un espace) sans téléphone vérifié n'a plus accès aux données ;
  les comptes Elite Emploi (hors espace) ne sont pas concernés.
- Gestion des membres (`inviter_membre`, `changer_role`, `retirer_membre`, `annuler_invitation`, `membres_espace`) :
  le code est exigé comme pour les données (avant : un mot de passe volé suffisait).
- `crm_definir_mfa_obligatoire(true)` : propriétaire validé par son code ; **refusé tant qu'un compte interne n'a pas
  de téléphone** (garde-fou anti-verrouillage).
- Fonctions d'administration Elite Emploi : plus exécutables sans connexion (SEC-09).
- Écran : enrôlement du téléphone proposé quand il est exigé ; porte « Plateforme » en deux étapes (mot de passe puis
  code) ; session de la plateforme gardée **pour l'onglet seulement** (sessionStorage) au lieu du stockage permanent.
- `public/_headers` : en-têtes de sécurité et CSP sur `crm.agence-elite.fr` (0 violation mesurée sur 13 écrans).

## Mise en service (dans cet ordre)
1. Sauvegarde de la base CRM (tableau de bord Supabase › Database › Backups, ou export).
2. Appliquer la migration (le CRM n'a pas de workflow de migration : SQL Editor, par Juste, après relecture).
   Effet immédiat : aucun pour les données ; la gestion des membres demande le code **seulement** aux comptes qui ont
   déjà un téléphone (0 aujourd'hui).
3. Fusionner la PR (Cloudflare déploie le site).
4. Chaque compte interne enrôle son téléphone (Réglages / écran de connexion), idéalement sur un 2e téléphone aussi.
5. Seulement ensuite : `select public.crm_definir_mfa_obligatoire(true);` (propriétaire, session validée par le code).

## Vérification locale
`scripts/verifier_mfa_crm.mjs` sur une base Supabase **locale** (refuse toute autre adresse), avec
`supabase/tests/socle_mfa_local.sql` comme socle (le dépôt ne reconstruit pas encore toute la base, SEC-08).
`AVANT=1` montre les failles sans la migration ; sans `AVANT`, 9 vérifications doivent passer.

## Retour arrière
- `select public.crm_definir_mfa_obligatoire(false);` (ou `update private.securite_crm set mfa_interne_obligatoire = false;`).
- Écran : revenir au commit précédent. En-têtes : retirer le bloc `https://crm.agence-elite.fr/*` de `public/_headers`.
- Fonctions : réinstaller les anciennes définitions (`supabase/double_auth.sql` et l'historique Git). Rien n'est supprimé.
