# Supabase — chemin reproductible V1

Les fichiers SQL historiques restent à la racine de ce dossier parce qu'ils correspondent aux migrations déjà appliquées en production. Leur ordre canonique est versionné dans [`migrations/legacy-order.txt`](migrations/legacy-order.txt).

## Base existante (production ou préproduction)

Ne relance pas le bootstrap et ne rejoue pas tous les anciens scripts.

1. Fais une sauvegarde Supabase.
2. Exécute intégralement `tests/diagnostic_avant_migration.sql`. Ses cinq premières requêtes ne doivent retourner aucune anomalie ; conserve aussi l'inventaire final des policies. Ce diagnostic couvre doublons, `workspace_id`, relations entre espaces, propriétaires et anciennes policies.
3. Pour référence, la requête de doublons exécutée par ce diagnostic est :

   ```sql
   select workspace_id, type, lower(btrim(numero)) numero, count(*)
   from public.documents
   where type in ('devis', 'facture') and numero is not null and btrim(numero) <> ''
   group by workspace_id, type, lower(btrim(numero)) having count(*) > 1;
   ```

4. Si les cinq diagnostics sont vides, applique uniquement les migrations `.sql` de `migrations/` qui ne figurent pas encore dans l'historique de la base. Pour la Pareto V1 : `20260930180000_pareto_v1_documents_uniques.sql`. Pour les photos du site : `20261010220000_site_photos.sql` (additive).
5. Exécute `tests/pareto_v1.sql`. Ce contrôle est non destructif et doit afficher `Pareto V1 : invariants critiques conformes`.

L'index unique échoue sans modifier les données si des doublons historiques existent. Corrige-les explicitement avant de relancer la migration ; ne supprime jamais arbitrairement un devis ou une facture.

## Base Supabase neuve

Prérequis : `psql`, une URL PostgreSQL directe dans `DATABASE_URL`, et une base Supabase vide.

```bash
DATABASE_URL='postgresql://…' ./scripts/supabase-bootstrap.sh
```

Le script refuse de toucher une base où `public.prospects` existe déjà. Il applique le socle historique dans l'ordre canonique, puis les migrations versionnées. Il n'injecte ni données de démonstration ni catalogue.

Après le bootstrap :

1. crée le compte propriétaire autorisé via Supabase Auth ; le trigger crée son espace ;
2. marque l'espace public si nécessaire (`site_public = true`) ;
3. exécute facultativement `store_catalogue.sql` après la création de cet espace ;
4. configure les secrets de l'Edge Function `rappels` et déploie-la ;
5. exécute `tests/pareto_v1.sql` ;
6. configure `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` côté Cloudflare Pages.

## Scripts de données qui ne font pas partie du bootstrap

| Script | Statut |
|---|---|
| `demo.sql` | Réinitialisation destructive du compte de démonstration uniquement. Jamais sur les données réelles. |
| `store_catalogue.sql` | Données initiales facultatives, à appliquer après création de l'espace public. |

L'ancien script propriétaire codé en dur a été supprimé du dépôt ; `espaces.sql` est son remplacement. Son contenu reste consultable dans l'historique Git si un audit historique l'exige.

## Ordre et dépendances essentiels

- `bootstrap_prerequis.sql` amorce `private.mfa_ok()` ; les tables métier/site/store/rappels existent ensuite avant `double_auth.sql`, qui réinstalle la fonction et toutes les politiques AAL2.
- `espaces.sql` dépend de `private.mfa_ok()` et remplace le propriétaire codé en dur.
- `audit.sql` dépend des espaces et des tables à auditer.
- `espace_donnees.sql` ajoute et remplit `workspace_id` avant la création de `events`.
- `acces_membres.sql` installe les règles par adhésion ; Step 6A met à jour les événements ; Step 6B retire enfin les anciennes policies `own …`.
- La règle finale reste : **espace + adhésion + rôle font foi**. Ne jamais recréer une policy métier permissive fondée seulement sur `user_id = auth.uid()`.
