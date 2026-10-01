# Plateforme des solutions métier (nom provisoire)

Base propre de la future plateforme qu'Agence Elite éditera et vendra : Solution Hôtel, Solution Restaurant, Solution Commerce, puis d'autres.

**État : structure et documentation seulement.** Il n'y a encore ni code, ni base, ni déploiement.

- **Séparée d'Agence Elite CRM.** Le CRM (`src/`, `site/`, `supabase/` à la racine) reste l'outil interne de l'agence. Rien ici n'est importé par le CRM ni construit avec lui.
- **Provisoirement dans ce dépôt.** Le dossier ira dans son propre dépôt GitHub dès qu'il existera. Cette session n'a pas le droit d'en créer un.
- **Point de départ neutre.** Elle ne reprend pas l'ancien prototype Elite Hôtel (archivé, voir `archive/a-supprimer/elite-hotel/`).
- **Le Kangourou reste intact** sur sa branche. On s'en servira comme modèle pour la Solution Commerce, sans le modifier.

## Structure
- `docs/ARCHITECTURE_CIBLE.md` : le modèle Client → Établissement → Solution.
- `docs/DECISIONS.md` : les décisions propres à la plateforme.
- `socle/` : ce qui est commun à toutes les solutions.
- `solutions/<id>/` : ce qui est propre à chaque solution.
- `supabase/` : le brouillon du schéma, **non appliqué**.
