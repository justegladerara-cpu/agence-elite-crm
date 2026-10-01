# Décisions de la plateforme

2026-10-01 · Agence Elite CRM reste l'outil interne et ne devient pas un logiciel métier · Raison : décision de Juste · Impact : la plateforme a son propre code et sa propre base.
2026-10-01 · Modèle Client → Établissement → Solution · Raison : un client peut avoir plusieurs établissements de solutions différentes · Impact : l'établissement est l'unité d'isolement.
2026-10-01 · Elite Hôtel archivé (« à supprimer »), pas réutilisé · Raison : décision de Juste · Impact : la Solution Hôtel part d'une base propre.
2026-10-01 · Kangourou préservé tel quel · Raison : client en service · Impact : servira de modèle à la Solution Commerce, sans être modifié.
À décider · Nom de la plateforme, dépôt GitHub dédié, projet Supabase dédié (l'organisation gratuite est pleine).
2026-10-01 · Un seul socle générique ; les solutions sont des configurations (listes de modules), pas des applications séparées · Raison : décision de Juste · Impact : un module est écrit une fois et partagé ; pas de dossier de code par solution.
2026-10-01 · Première solution : Commerce, avec Kangourou comme référence fonctionnelle · Raison : logiciel déjà en service · Impact : aucun développement dans la branche Kangourou, aucune donnée réelle migrée.
2026-10-01 · Architecture du socle validée par Juste (22:16) · Dépôt dédié : `agence-elite-platform` · Impact : le Lot 1 démarre dans ce dépôt dès qu'il est accessible ; ce dossier `plateforme/` y sera repris puis retiré du CRM.
2026-10-01 · Couche `abonnements / licences` prévue dans l'architecture, distincte des solutions, modules et permissions · Impact : aucune facturation dans le Lot 1, mais l'activation d'un module pour un établissement passe par un « droit commercial » qui pourra ensuite venir d'un abonnement.
2026-10-01 · Trois notions séparées : module **proposé** par une solution (`solution_modules`), module **accordé et activé** pour un établissement (`etablissement_modules`, plus tard rattaché à une licence), **permission** d'un utilisateur (rôle + ajustements) · Impact : un écran n'est accessible que si les trois sont vrais.
2026-10-01 · Un dirigeant (`client_membres`) peut aussi être membre opérationnel (`etablissement_membres`) de certains établissements · Impact : ses droits sont l'union de la lecture « dirigeant » et de son rôle local.
2026-10-01 · Lot 1 sans aucun module métier (ni Commerce, ni Restaurant, ni Hôtel) · Ordre : modèle de données → RLS/sécurité → tests d'isolation → authentification/contexte → administration Agence Elite → interfaces.
2026-10-01 · Supabase en local d'abord, migrations toutes versionnées · Impact : une nouvelle base doit pouvoir être créée entièrement depuis zéro avec `supabase/migrations/`.
