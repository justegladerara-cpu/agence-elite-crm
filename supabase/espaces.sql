-- Préparé le 2026-09-29, NON APPLIQUÉ (attend l'accord de Juste) : espaces de travail, adhésions et rôles ;
-- fin de l'identifiant propriétaire et des e-mails écrits en dur.
-- Les données métier restent rattachées à user_id ; la bascule vers workspace_id se fera table par table.

create schema if not exists private;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  owner_id uuid not null references auth.users on delete cascade,
  -- Espace qui publie le site agence-elite (catalogue, contact, visites). Un seul.
  site_public boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists workspaces_un_site_public on public.workspaces ((true)) where site_public;
create index if not exists workspaces_owner on public.workspaces (owner_id);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'membre' check (role in ('proprietaire', 'admin', 'membre', 'lecteur')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user on public.workspace_members (user_id);

-- Espaces de l'utilisateur connecté (fonction hors API : évite la récursion des politiques)
create or replace function private.mes_espaces() returns setof uuid language sql stable security definer set search_path = '' as $$
  select workspace_id from public.workspace_members where user_id = (select auth.uid())
$$;
revoke all on function private.mes_espaces() from public, anon;
grant execute on function private.mes_espaces() to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
drop policy if exists "espaces membres" on public.workspaces;
create policy "espaces membres" on public.workspaces for select to authenticated using (id in (select private.mes_espaces()));
drop policy if exists "espaces proprietaire" on public.workspaces;
create policy "espaces proprietaire" on public.workspaces for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "adhesions visibles" on public.workspace_members;
create policy "adhesions visibles" on public.workspace_members for select to authenticated using (workspace_id in (select private.mes_espaces()));
drop policy if exists "double authentification" on public.workspaces;
create policy "double authentification" on public.workspaces as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
drop policy if exists "double authentification" on public.workspace_members;
create policy "double authentification" on public.workspace_members as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));

-- Un espace par compte existant ; celui du propriétaire historique publie le site
insert into public.workspaces (nom, owner_id, site_public)
select case when lower(u.email) = 'demo@agence-elite.fr' then 'Démo' else 'Agence Elite' end, u.id, lower(u.email) = 'justegladerara@gmail.com'
from auth.users u
where not exists (select 1 from public.workspaces w where w.owner_id = u.id);
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'proprietaire' from public.workspaces w
on conflict do nothing;

-- Propriétaire du site public : lu par les fonctions du site et la politique du catalogue
create or replace function private.site_proprietaire() returns uuid language sql stable security definer set search_path = '' as $$
  select owner_id from public.workspaces where site_public limit 1
$$;
grant usage on schema private to anon;
revoke all on function private.site_proprietaire() from public;
grant execute on function private.site_proprietaire() to anon, authenticated;

-- Les fonctions du site et de la boutique ne portent plus d'identifiant en dur
do $$
declare f record;
begin
  for f in select p.oid from pg_proc p join pg_namespace s on s.oid = p.pronamespace
           where s.nspname = 'public' and p.proname in ('site_visite', 'site_contact', 'store_passer_commande') loop
    execute replace(pg_get_functiondef(f.oid), 'proprio uuid := ''759b0b53-9fa9-4394-a2cd-beccce1a05d0''', 'proprio uuid := private.site_proprietaire()');
  end loop;
end $$;

drop policy if exists "catalogue public" on public.store_produits;
create policy "catalogue public" on public.store_produits for select to anon, authenticated
  using ((actif and user_id = (select private.site_proprietaire())) or user_id = (select auth.uid()));

-- Inscriptions : liste d'e-mails autorisés (table hors API) au lieu d'e-mails écrits dans le code
create table if not exists private.inscriptions_autorisees (email text primary key check (email = lower(email)));
revoke all on private.inscriptions_autorisees from public, anon, authenticated;
insert into private.inscriptions_autorisees values ('justegladerara@gmail.com'), ('demo@agence-elite.fr') on conflict do nothing;

create or replace function public.crm_single_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from private.inscriptions_autorisees a where a.email = lower(new.email))
     or exists (select 1 from auth.users u where lower(u.email) = lower(new.email)) then
    raise exception 'Inscriptions fermées';
  end if;
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end;
$$;

-- Nouveau compte : son espace et son adhésion de propriétaire
create or replace function public.crm_nouvel_espace()
returns trigger language plpgsql security definer set search_path = '' as $$
declare w uuid;
begin
  insert into public.workspaces (nom, owner_id) values (coalesce(nullif(split_part(new.email, '@', 1), ''), 'Mon espace'), new.id) returning id into w;
  insert into public.workspace_members (workspace_id, user_id, role) values (w, new.id, 'proprietaire');
  return new;
end;
$$;
revoke execute on function public.crm_nouvel_espace() from public, anon, authenticated;
drop trigger if exists crm_nouvel_espace on auth.users;
create trigger crm_nouvel_espace after insert on auth.users for each row execute function public.crm_nouvel_espace();
