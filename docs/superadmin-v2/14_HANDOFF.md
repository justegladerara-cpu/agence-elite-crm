# 14 — Passation

Point de reprise : `JOURNAL.md` (une section par lot : fait, décisions, bloqué, prochaine étape).

## Où en est le travail (2026-10-21)

| Lot | PR CRM (brouillon) | Branche | Base de la PR |
|---|---|---|---|
| 0 Aperçu sûr, mesures | #21 | `claude/superadmin-v2-lot-0` | production |
| 1 Sécurité | #22 | `lot-1` | `lot-0` |
| 2 Navigation | #23 | `lot-2` | `lot-1` |
| 3 Design | #24 | `lot-3` | `lot-2` |
| 4 Tour de contrôle | #25 | `lot-4` | `lot-3` |
| 5 Fiche client | #26 | `lot-5` | `lot-4` |
| 6 Calculs, formulaires | #27 | `lot-6` | `lot-5` |
| 7 Documents, mesures | #28 | `lot-7` | `lot-6` |

Plateforme : PR #72 (`claude/superadmin-v2-idempotence-motifs`), brouillon, **non fusionnée, non appliquée**.

## Pour fusionner (avec l'accord écrit de Juste, lot par lot)

1. Fusionner #21 dans la production, puis changer la base de #22 vers la production, et ainsi de suite.
   Ou fusionner #28 (qui contient tout) en une fois. Jamais de `push --force` ni de `rebase` sur la production.
2. Vérifier l'aperçu Cloudflare de la production après chaque fusion.
3. Ordre « base d'abord » côté plateforme : appliquer #72 par le workflow « Déploiement de la base », puis seulement
   ajouter `p_motif` aux trois appels du CRM (D5-2).

## Ce qui attend un accord écrit

- Migration CRM `20260930180000_pareto_v1_documents_uniques.sql` (SEC-08).
- Migration CRM proposée SEC-14 (`migrations-proposees/SEC-14_inscriptions_emploi.sql`).
- PR plateforme #72.

## Bloqué

- Audit du 2026-10-21 et maquette absents : identifiants propres à la mission, rapprochement à faire (D0-1, D0-2).
- PR #72 : test de date `rh.test.js` rouge aussi sur `main` plateforme ; « Workers Builds » rouge sur toutes les PR
  plateforme.

## Outils

Voir `README.md` (aperçu local, plateforme fictive, mesures).
