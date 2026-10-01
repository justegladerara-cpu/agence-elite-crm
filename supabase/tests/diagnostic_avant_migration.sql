-- Diagnostic V1 strictement en lecture seule, à exécuter AVANT toute migration.
-- Les cinq premières requêtes doivent retourner 0 ligne (ou total = 0).

-- 1. Doublons de devis et factures, séparés par espace et type.
select workspace_id, type, lower(btrim(numero)) as numero_normalise, count(*) as total,
       array_agg(id order by created_at) as documents
from public.documents
where type in ('devis', 'facture') and numero is not null and btrim(numero) <> ''
group by workspace_id, type, lower(btrim(numero))
having count(*) > 1
order by workspace_id, type, numero_normalise;

-- 2. Lignes métier qui ne sont rattachées à aucun espace.
select table_name, total
from (
  select 'prospects' table_name, count(*) total from public.prospects where workspace_id is null
  union all select 'actions', count(*) from public.actions where workspace_id is null
  union all select 'documents', count(*) from public.documents where workspace_id is null
  union all select 'settings', count(*) from public.settings where workspace_id is null
  union all select 'site_demandes', count(*) from public.site_demandes where workspace_id is null
  union all select 'site_visites', count(*) from public.site_visites where workspace_id is null
  union all select 'store_produits', count(*) from public.store_produits where workspace_id is null
  union all select 'store_commandes', count(*) from public.store_commandes where workspace_id is null
  union all select 'store_cles', count(*) from public.store_cles where workspace_id is null
) x where total > 0;

-- 3. Actions/documents reliés à un prospect d'un autre espace.
select 'actions' table_name, a.id::text entite_id, a.workspace_id espace_entite, p.workspace_id espace_prospect
from public.actions a join public.prospects p on p.id = a.prospect_id
where a.workspace_id is distinct from p.workspace_id
union all
select 'documents', d.id::text, d.workspace_id, p.workspace_id
from public.documents d join public.prospects p on p.id = d.prospect_id
where d.workspace_id is distinct from p.workspace_id;

-- 4. Espaces dont le propriétaire n'a pas exactement l'adhésion propriétaire attendue.
select w.id workspace_id, w.owner_id,
       count(*) filter (where m.user_id = w.owner_id and m.role = 'proprietaire') as adhesions_proprietaire
from public.workspaces w
left join public.workspace_members m on m.workspace_id = w.id
group by w.id, w.owner_id
having count(*) filter (where m.user_id = w.owner_id and m.role = 'proprietaire') <> 1;

-- 5. Anciennes policies métier permissives qui ne doivent jamais revenir après Step 6B.
select schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('prospects', 'actions', 'documents', 'settings')
  and policyname like 'own %'
order by tablename, policyname;

-- 6. Inventaire à conserver avec le rapport : policies réellement installées sur le périmètre critique.
select tablename, policyname, cmd, permissive, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('workspaces', 'workspace_members', 'prospects', 'actions', 'documents', 'settings', 'events', 'audit_log')
order by tablename, policyname;
