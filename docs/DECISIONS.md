# Décisions

2026-09-26 · CRM = source de vérité, Excel en import/export · Raison : pilotage simple · Impact : garder `excel.js` compatible avec le modèle de pilotage.
2026-09-28 · Hébergement Cloudflare Pages (Netlify abandonné) · Raison : crédits Netlify épuisés · Impact : push = déploiement ; netlify.toml obsolète.
2026-09-28 · Inscriptions fermées (2 e-mails, trigger `crm_single_owner`) · Raison : outil personnel · Impact : bloque le multi-utilisateur.
2026-09-28 · Remplacement de la lib xlsx par `tableur.js` · Raison : failles non corrigées · Impact : ne pas réintroduire xlsx.
2026-09-29 · Aucun chiffre inventé dans le tableau de bord · Raison : décisions sur données réelles · Impact : afficher « pas de données » plutôt qu'une valeur.
2026-09-29 · Protocole d'économie de contexte · Raison : demande de Juste · Impact : lire ces 3 fichiers en début de session, contexte minimal, mise à jour ciblée.
