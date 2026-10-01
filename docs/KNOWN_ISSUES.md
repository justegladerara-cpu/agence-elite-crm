# Problèmes connus (audit du 2026-09-29)

[HIGH] Logique métier uniquement côté navigateur, chargement total au démarrage
[MED] 2FA jamais activée (0 facteur)
[MED] Unicité des numéros de devis/factures : code et migration `20260930180000_pareto_v1_documents_uniques.sql` préparés et validés (diagnostic production sans doublon, migration + `pareto_v1.sql` réussis en transaction annulée le 2026-10-01, conflit géré par la file de synchronisation), mais **index non encore appliqué en production**. Passer en résolu seulement après application.
[MED] Corbeille et date de sauvegarde stockées sur l'appareil seulement
[MED] Protection mots de passe compromis désactivée (offre payante Supabase requise)
[LOW] Inscriptions limitées par private.inscriptions_autorisees (accès par espace/rôle réglé au Step 6B)
[LOW] 54 avertissements oxlint (aucune erreur)
[LOW] Index manquants : site_demandes.prospect_id, store_cles.user_id
[LOW] Temps réel du tableau de bord non vérifié en ligne
