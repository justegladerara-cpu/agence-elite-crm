# Plateforme des solutions métier (nom provisoire)

Base propre de la future plateforme qu'Agence Elite éditera et vendra.

**État : conception seulement.** Pas de code, pas de base, pas de déploiement.

## Principe : un seul socle, des solutions configurées
```
Agence Elite (éditeur / super-admin)
→ Clients
→ Établissements
→ Solution (Commerce, Restaurant, Hôtel…)
→ Modules activés
→ Utilisateurs / rôles / permissions
→ Données de l'établissement
```
- **Une seule application, une seule base, un seul code.** Commerce, Restaurant et Hôtel ne sont pas des applications séparées.
- **Une solution est une entrée du catalogue** : la liste des modules qu'elle propose et ses réglages par défaut.
- **Un module est écrit une seule fois** et sert à toutes les solutions qui l'incluent (exemple : la caisse sert à Commerce et à Restaurant).
- **Un client peut avoir plusieurs établissements**, chacun avec sa solution : un magasin, un restaurant, un hôtel.
- **Première solution : Commerce.** Le logiciel Le Kangourou sert de référence fonctionnelle. Il reste intact : aucun développement dans sa branche, aucune donnée réelle migrée.

## Organisation
- `docs/ARCHITECTURE_CIBLE.md` : le socle, ses entités et ses règles.
- `docs/DECISIONS.md` : les décisions propres à la plateforme.
- `catalogue/solutions.md` : les solutions, décrites comme des données.
- `catalogue/modules.md` : le catalogue unique des modules (communs et métier).
- `supabase/brouillon_schema_socle.sql` : le brouillon du schéma, **non appliqué**.

Ce dossier est provisoire dans le dépôt du CRM. Il ira dans son propre dépôt GitHub quand celui-ci existera. Rien ici n'est importé par le CRM ni construit avec lui. L'ancien prototype Elite Hôtel est archivé et ne sert pas de base.
