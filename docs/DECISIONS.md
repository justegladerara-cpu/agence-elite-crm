# Décisions

2026-09-26 · CRM = source de vérité, Excel en import/export · Raison : pilotage simple · Impact : garder `excel.js` compatible avec le modèle de pilotage.
2026-09-28 · Hébergement officiel Cloudflare Pages, ancien hébergeur abandonné · Raison : pérenniser le déploiement · Impact : deux projets Pages : CRM (branche `claude/project-thread-j6wx9s`, `npm run build` → `dist`) et site public (branche `site`, `node site/build.mjs out` → `out`).
2026-09-28 · Inscriptions fermées (2 e-mails, trigger `crm_single_owner`) · Raison : outil personnel · Impact : bloque le multi-utilisateur.
2026-09-28 · Remplacement de la lib xlsx par `tableur.js` · Raison : failles non corrigées · Impact : ne pas réintroduire xlsx.
2026-09-29 · Aucun chiffre inventé dans le tableau de bord · Raison : décisions sur données réelles · Impact : afficher « pas de données » plutôt qu'une valeur.
2026-09-29 · Protocole d'économie de contexte · Raison : demande de Juste · Impact : lire ces 3 fichiers en début de session, contexte minimal, mise à jour ciblée.
2026-09-29 · Architecture core + modules, migration progressive (docs/ARCHITECTURE.md) · Raison : ajouter des modules sans réécrire · Impact : un module n'importe que core/ et lib/ pur ; désactiver ne supprime aucune donnée.
2026-09-29 · Espaces de travail + rôles, plus d'identifiant en dur · Raison : multi-utilisateur futur, module Vie perso · Impact : nouvelles tables liées à un espace ; bascule user_id → workspace_id table par table.
2026-09-29 · Journal d'audit séparé du journal métier · Raison : sécurité · Impact : ne jamais écrire d'événement métier dans audit_log ni l'inverse.
2026-10-01 · Agence Elite CRM reste l'outil interne ; les solutions vendues (Hôtel, Restaurant, Commerce) iront dans une plateforme séparée Client → Établissement → Solution · Raison : décision de Juste · Impact : rien de métier hôtel ou magasin dans le CRM ; base propre dans `plateforme/` en attendant un dépôt dédié.
2026-10-01 · Elite Hôtel archivé (« à supprimer »), Kangourou préservé · Raison : décision de Juste · Impact : branche hôtel inerte, tables `h_*` hors API dans Supabase kangourou-gestion, voir `archive/a-supprimer/elite-hotel/`.
