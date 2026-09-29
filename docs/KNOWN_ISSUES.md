# Problèmes connus (audit du 2026-09-29)

[HIGH] Logique métier uniquement côté navigateur, chargement total au démarrage
[MED] 2FA jamais activée (0 facteur)
[MED] Pas d'unicité de `documents.numero` en base
[MED] Corbeille et date de sauvegarde stockées sur l'appareil seulement
[MED] Protection mots de passe compromis désactivée (offre payante Supabase requise)
[LOW] Inscriptions limitées par private.inscriptions_autorisees (accès par espace/rôle réglé au Step 6B)
[LOW] README et netlify.toml obsolètes
[LOW] 54 avertissements oxlint (aucune erreur)
[LOW] Index manquants : site_demandes.prospect_id, store_cles.user_id
[LOW] Temps réel du tableau de bord non vérifié en ligne
