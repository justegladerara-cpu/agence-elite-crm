# ARCHIVE — ELITE HÔTEL — À SUPPRIMER

Elite Hôtel n'est plus un projet actif depuis le 1er octobre 2026, sur décision de Juste. Ce dossier sert seulement de repère : il n'y a jamais eu de code hôtel dans cette branche du CRM.

| Élément | Où | État |
|---|---|---|
| Code | branches `archive/a-supprimer/elite-hotel` et `claude/project-thread-hp6xmt` (commit `ff35a8b`) | Le site affiche un avis d'archive. Dernière version fonctionnelle : `20f4bbc`, parent du commit d'archivage. |
| Base | Supabase kangourou-gestion, schéma `archive_elite_hotel_a_supprimer` (tables `h_*`) | Hors API, aucun droit |
| Fonctions | `public.archive_elite_hotel_a_supprimer_*` | Neutralisées (aucun accès). Gardées tant que la règle de stockage `h espace recus` existe. |
| Fichiers | bucket `h-recus` | Vide, bloqué |
| Comptes | `pdg@kangou.com`, `demo@kangourou.com` | Désactivés |
| Sauvegardes | dossier projet `archive/a-supprimer/elite-hotel/` (bundle Git, `hotel.sql`, données JSON, captures) et schéma `sauvegarde_20261001` | Conservées |

La suppression définitive se fera plus tard avec le script `suppression-definitive-plus-tard.sql` du dossier projet. Il faut une validation humaine dans Supabase et la suppression de la branche sur GitHub.

**Ne pas réutiliser comme base de la future plateforme** (voir `plateforme/`). Le logiciel Le Kangourou (branche `claude/project-thread-bm6nwc`) n'est pas concerné.
