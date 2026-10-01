-- Contrôles non destructifs de la structure V1. À exécuter après les migrations dans le SQL Editor.
-- Le script lève une exception au premier invariant critique absent et ne modifie aucune donnée métier.
do $$
declare
  t text;
  n bigint;
  definition text;
begin
  -- Step 6B : aucune ancienne policy propriétaire fondée seulement sur user_id ne doit revenir.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename in ('prospects', 'actions', 'documents', 'settings')
      and policyname like 'own %'
  ) then
    raise exception 'SECURITE: une ancienne policy own contourne les rôles de l espace';
  end if;

  foreach t in array array['prospects', 'actions', 'documents'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'membres lecture')
       or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'membres ajout')
       or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'membres modification')
       or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'gestion suppression')
       or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'membres suppression propre') then
      raise exception 'SECURITE: policies par rôle incomplètes sur %', t;
    end if;
  end loop;

  select pg_get_functiondef('private.rattacher_espace()'::regprocedure) into definition;
  if definition not like '%workspace_members%' or definition not like '%proprietaire%' or definition not like '%admin%' or definition not like '%membre%' then
    raise exception 'SECURITE: rattacher_espace ne vérifie plus adhésion et rôle';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'enregistrer_reglages' and p.prosecdef
  ) or has_function_privilege('anon', 'public.enregistrer_reglages(uuid,jsonb)', 'execute') then
    raise exception 'SECURITE: RPC enregistrer_reglages absente, non protégée ou ouverte à anon';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.actions'::regclass and tgname = 'evenement' and not tgisinternal
      and (tgtype::int & 16) = 16
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.documents'::regclass and tgname = 'evenement' and not tgisinternal
      and (tgtype::int & 16) = 16
  ) then
    raise exception 'STEP 6A: le journal ne suit plus les UPDATE';
  end if;

  foreach t in array array['prospects','actions','documents','settings','site_demandes','site_visites','store_produits','store_commandes','store_cles'] loop
    execute format('select count(*) from public.%I where workspace_id is null', t) into n;
    if n > 0 then raise exception 'MULTI-ESPACE: % contient % ligne(s) sans workspace_id', t, n; end if;
  end loop;

  if exists (
    select 1 from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
    where m.user_id = w.owner_id and m.role <> 'proprietaire'
  ) or exists (
    select 1 from public.workspaces w
    where not exists (select 1 from public.workspace_members m where m.workspace_id = w.id and m.user_id = w.owner_id and m.role = 'proprietaire')
  ) then
    raise exception 'MULTI-ESPACE: adhésion propriétaire incohérente';
  end if;

  if exists (
    select 1 from public.actions a join public.prospects p on p.id = a.prospect_id where a.workspace_id <> p.workspace_id
  ) or exists (
    select 1 from public.documents d join public.prospects p on p.id = d.prospect_id where d.workspace_id <> p.workspace_id
  ) then
    raise exception 'MULTI-ESPACE: relation vers un prospect d un autre espace';
  end if;

  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'documents_workspace_type_numero_unique') then
    raise exception 'DOCUMENTS: index unique devis/facture absent';
  end if;

  if exists (
    select 1 from public.documents
    where type in ('devis', 'facture') and numero is not null and btrim(numero) <> ''
    group by workspace_id, type, lower(btrim(numero)) having count(*) > 1
  ) then
    raise exception 'DOCUMENTS: numéros en doublon dans un espace';
  end if;
end $$;

select 'Pareto V1 : invariants critiques conformes' as resultat;
