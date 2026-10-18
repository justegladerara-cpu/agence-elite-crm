# Branches du dépôt CRM

Mis à jour le 2026-10-18. La branche principale est `claude/project-thread-j6wx9s` : Cloudflare Pages construit
https://crm.agence-elite.fr et www.agence-elite.fr à partir d'elle. On ne la renomme pas sans changer en même temps le
réglage « Production branch » des projets Cloudflare.

## À garder

| Branche | Rôle |
|---|---|
| `claude/project-thread-j6wx9s` | Branche principale (production du CRM et du site vitrine). |
| `site` | Ancienne branche de publication du site vitrine. Gardée tant qu'un projet Cloudflare peut encore la construire. |

## Archives (code d'anciens logiciels, à ne pas fusionner)

| Branche | Contenu | Décision |
|---|---|---|
| `claude/project-thread-bm6nwc` | Logiciel de magasin Le Kangourou (arrêté le 2026-10-02, base supprimée). Copie aussi dans les fichiers du projet : `kangourou/sauvegardes/`. | Garder comme archive. |
| `claude/project-thread-hp6xmt` | Prototype Elite Hôtel (archivé le 2026-10-01). | Garder une seule des deux branches. |
| `archive/a-supprimer/elite-hotel` | Même commit que `claude/project-thread-hp6xmt` (`ff35a8b`). | Doublon : peut être supprimée. |
| `claude/codex-test-pilotage` | Test de pilotage de Codex (1 commit, PR #3 fermée). | Peut être supprimée. |
| `codex/analyse-2026-10-09` | Analyse du CRM par Codex (1 commit de documentation, jamais fusionné). | Garder tant que l'analyse sert. |

## Déjà fusionnées (rien ne s'y perd si on les supprime)

Tout leur contenu est déjà dans `claude/project-thread-j6wx9s` :
`claude/adresse-site-www`, `claude/animations-tableaux-de-bord`, `claude/documents-et-points`,
`claude/elite-emploi-charte`, `claude/elite-emploi-recrutement`, `claude/elite-motion-site`,
`claude/master-handoff-dnni01`, `claude/project-thread-5xo0mj`, `claude/project-thread-jnivmo`,
`codex/creer-journal-de-memoire-persistante`.

Pour les supprimer : GitHub › onglet **Branches** › icône corbeille à droite de chaque branche (une branche supprimée
se restaure au même endroit pendant quelques jours).

## Règle pour la suite

Une branche par travail, supprimée dès que sa PR est fusionnée (réglage conseillé : Settings › General ›
« Automatically delete head branches »).
