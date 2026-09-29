-- Étape 4a : chaque ligne métier est rattachée à son espace de travail (workspace_id).
-- Appliqué le 2026-09-29 (migration espace_donnees) : 0 ligne sans espace, 0 ligne ajoutée au journal d'audit.
-- Ajout seulement : la sécurité (RLS) reste sur user_id ; la lecture par espace viendra ensuite, table par table.
-- Le trigger remplit workspace_id à l'insertion depuis user_id (la valeur envoyée par le client est ignorée) et l'empêche de changer.

create or replace function private.espace_de(u uuid) returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.workspaces where owner_id = u order by created_at limit 1
$$;
revoke all on function private.espace_de(uuid) from public, anon, authenticated;

create or replace function private.rattacher_espace() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.workspace_id := private.espace_de(new.user_id);
  else
    new.workspace_id := old.workspace_id;
  end if;
  return new;
end $$;
revoke all on function private.rattacher_espace() from public, anon, authenticated;

do $$
declare t text; a boolean;
begin
  foreach t in array array['prospects', 'actions', 'documents', 'settings', 'site_demandes', 'site_visites', 'store_produits', 'store_commandes', 'store_cles'] loop
    execute format('alter table public.%I add column if not exists workspace_id uuid references public.workspaces on delete cascade', t);
    -- Rattrapage sans remplir le journal d'audit de milliers de lignes techniques
    a := exists (select 1 from pg_trigger where tgname = 'journal_audit' and tgrelid = format('public.%I', t)::regclass);
    if a then execute format('alter table public.%I disable trigger journal_audit', t); end if;
    execute format('update public.%I x set workspace_id = private.espace_de(x.user_id) where workspace_id is null', t);
    if a then execute format('alter table public.%I enable trigger journal_audit', t); end if;
    execute format('create index if not exists %I on public.%I (workspace_id)', t || '_workspace', t);
    execute format('drop trigger if exists rattacher_espace on public.%I', t);
    execute format('create trigger rattacher_espace before insert or update of workspace_id on public.%I for each row execute function private.rattacher_espace()', t);
  end loop;
end $$;
