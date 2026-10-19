-- Socle minimal du CRM, recopié des définitions de production (19/10/2026), pour tester la migration MFA.
create schema if not exists private;
create table public.workspaces (id uuid primary key default gen_random_uuid(), nom text, owner_id uuid references auth.users(id));
create table public.workspace_members (workspace_id uuid references public.workspaces(id), user_id uuid references auth.users(id), role text, created_at timestamptz default now(), primary key (workspace_id, user_id));
create table private.invitations (workspace_id uuid, email text, role text, invite_par uuid, acceptee_le timestamptz, primary key (workspace_id, email));
create table private.inscriptions_autorisees (email text primary key);
create table public.prospects (id uuid primary key default gen_random_uuid(), workspace_id uuid, nom text);
create table public.client_errors (id bigint generated always as identity primary key, user_id uuid default auth.uid(), message text);
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.prospects enable row level security;
alter table public.client_errors enable row level security;
create or replace function private.mfa_ok() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified') $$;
grant usage on schema private to authenticated;
grant execute on function private.mfa_ok() to authenticated;
create or replace function private.mes_espaces() returns setof uuid language sql stable security definer set search_path = '' as $$
  select workspace_id from public.workspace_members where user_id = (select auth.uid()) $$;
grant execute on function private.mes_espaces() to authenticated;
create policy membres on public.prospects for all to authenticated using (workspace_id in (select private.mes_espaces())) with check (workspace_id in (select private.mes_espaces()));
create policy "double authentification" on public.prospects as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
create policy propre on public.client_errors for insert to authenticated with check (user_id = auth.uid());
create policy "double authentification" on public.client_errors as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
create policy lecture on public.workspace_members for select to authenticated using (workspace_id in (select private.mes_espaces()));
create policy "double authentification" on public.workspace_members as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
grant select, insert, update, delete on public.prospects, public.client_errors, public.workspace_members to authenticated;
-- Fonctions de gestion (corps de production)
create or replace function private.verifier_gestion(w uuid, nouveau_role text) returns void language plpgsql stable security definer set search_path = '' as $$
declare mon_role text;
begin
  select role into mon_role from public.workspace_members where workspace_id = w and user_id = (select auth.uid());
  if mon_role is null or mon_role not in ('proprietaire', 'admin') then raise exception 'Seul le propriétaire ou un admin gère les membres'; end if;
  if nouveau_role is not null and nouveau_role not in ('admin', 'membre', 'lecteur') then raise exception 'Rôle inconnu'; end if;
  if nouveau_role = 'admin' and mon_role <> 'proprietaire' then raise exception 'Seul le propriétaire nomme un admin'; end if;
end $$;
grant execute on function private.verifier_gestion(uuid, text) to authenticated;
create or replace function public.inviter_membre(w uuid, p_email text, p_role text) returns text language plpgsql security definer set search_path = '' as $$
declare e text := lower(trim(p_email)); u uuid;
begin
  perform private.verifier_gestion(w, p_role);
  insert into private.inscriptions_autorisees values (e) on conflict do nothing;
  insert into private.invitations (workspace_id, email, role, invite_par) values (w, e, p_role, (select auth.uid()))
  on conflict (workspace_id, email) do update set role = excluded.role, invite_par = excluded.invite_par, acceptee_le = null;
  return 'invite';
end $$;
create or replace function public.membres_espace(w uuid) returns table(user_id uuid, email text, role text, en_attente boolean) language sql stable security definer set search_path = '' as $$
  select m.user_id, u.email::text, m.role, false from public.workspace_members m join auth.users u on u.id = m.user_id
  where m.workspace_id = w and w in (select private.mes_espaces())
  union all
  select null, i.email, i.role, true from private.invitations i
  where i.workspace_id = w and i.acceptee_le is null and w in (select private.mes_espaces()) $$;
-- Fonction d'administration Emploi exposée à anon (comme en production)
create or replace function public.emploi_profils_recus() returns setof uuid language sql stable security definer set search_path = '' as $$ select null::uuid where false $$;
grant execute on function public.emploi_profils_recus() to anon, authenticated;
