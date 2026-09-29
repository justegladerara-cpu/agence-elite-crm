-- Journal d'audit (sécurité), séparé du journal métier `actions` : qui a fait quoi, sur quoi, quand, depuis quel appareil.
-- Seules les opérations réussies y figurent (une opération refusée est annulée avec sa ligne de journal).
-- Lecture seule pour le propriétaire des données ; personne ne peut le modifier depuis l'application.
-- Préparé le 2026-09-29, à appliquer après espaces.sql.

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  acteur uuid,
  role text,
  operation text not null,
  table_name text not null,
  entite_id text,
  proprietaire uuid,
  champs text[],
  appareil text,
  ip text
);
create index if not exists audit_log_proprietaire on public.audit_log (proprietaire, at desc);
alter table public.audit_log enable row level security;
drop policy if exists "journal proprietaire" on public.audit_log;
create policy "journal proprietaire" on public.audit_log for select to authenticated using (proprietaire = (select auth.uid()));
drop policy if exists "double authentification" on public.audit_log;
create policy "double authentification" on public.audit_log as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));

create or replace function private.journaliser() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  champs text[];
  h json;
begin
  if tg_op = 'UPDATE' then
    select array_agg(e.key order by e.key) into champs from jsonb_each(r) e where to_jsonb(old) -> e.key is distinct from e.value;
    if champs is null then return null; end if;
  end if;
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then h := null;
  end;
  insert into public.audit_log (acteur, role, operation, table_name, entite_id, proprietaire, champs, appareil, ip)
  values ((select auth.uid()), coalesce((select auth.role()), current_user), lower(tg_op), tg_table_name,
    coalesce(r ->> 'id', r ->> 'workspace_id', r ->> 'user_id'), coalesce(r ->> 'user_id', r ->> 'owner_id')::uuid, champs,
    left(h ->> 'user-agent', 200), split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1));
  return null;
end $$;
revoke all on function private.journaliser() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['prospects', 'actions', 'documents', 'settings', 'store_produits', 'store_commandes', 'store_cles', 'site_demandes', 'push_subscriptions', 'workspaces', 'workspace_members'] loop
    execute format('drop trigger if exists journal_audit on public.%I', t);
    execute format('create trigger journal_audit after insert or update or delete on public.%I for each row execute function private.journaliser()', t);
  end loop;
end $$;
