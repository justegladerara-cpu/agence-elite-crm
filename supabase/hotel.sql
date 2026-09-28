-- SaaS hôtelier (Agence Elite) : tables dédiées, préfixe h_, séparées de tout autre logiciel du même projet Supabase.
-- Chaque hôtel client est un « établissement » (espace) ; le superadmin crée les établissements et choisit leurs modules.

-- ---------- Établissements ----------
create table if not exists public.h_etablissements (
  id text primary key,
  nom text not null,
  modules jsonb not null default '{"hebergement": true, "restaurant": true, "bar": true}'::jsonb,
  ville text not null default '',
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Équipe ----------
create table if not exists public.h_membres (
  email text primary key,
  nom text not null default '',
  role text not null default 'caisse' check (role in ('superadmin', 'pdg', 'caisse', 'comptable')),
  espace text not null references public.h_etablissements (id) on update cascade,
  droits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.h_membres enable row level security;
alter table public.h_etablissements enable row level security;

create or replace function public.h_mon_email() returns text language sql stable set search_path = '' as $$
  select lower(coalesce((select auth.jwt() ->> 'email'), ''))
$$;
create or replace function public.h_mon_role() returns text language sql stable security definer set search_path = '' as $$
  select role from public.h_membres where email = public.h_mon_email()
$$;
create or replace function public.h_mon_espace() returns text language sql stable security definer set search_path = '' as $$
  select m.espace from public.h_membres m join public.h_etablissements e on e.id = m.espace
   where m.email = public.h_mon_email() and (e.actif or m.role = 'superadmin')
$$;
create or replace function public.h_droit_defaut(r text, d text) returns boolean language sql immutable set search_path = '' as $$
  select case
    when r in ('superadmin', 'pdg') then true
    when r = 'caisse' then d in ('vendre', 'remises', 'credit', 'articles', 'salle', 'reception')
    when r = 'comptable' then d in ('annuler', 'finances', 'depenses')
    else false end
$$;
create or replace function public.h_mon_droit(d text) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select case when m.role = 'superadmin' then true else coalesce((m.droits ->> d)::boolean, public.h_droit_defaut(m.role, d)) end
       from public.h_membres m where m.email = public.h_mon_email()),
    false)
$$;
create or replace function public.h_espace_du_compte(u text) returns text language sql stable security definer set search_path = public, auth as $$
  select m.espace from auth.users a join public.h_membres m on lower(m.email) = lower(a.email) where a.id::text = u
$$;
do $$ declare f text; begin
  foreach f in array array['h_mon_role()', 'h_mon_espace()', 'h_mon_droit(text)', 'h_espace_du_compte(text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

create policy "h etab lecture" on public.h_etablissements for select to authenticated
  using ((select public.h_mon_role()) = 'superadmin' or id = (select public.h_mon_espace()));
create policy "h etab superadmin" on public.h_etablissements for all to authenticated
  using ((select public.h_mon_role()) = 'superadmin') with check ((select public.h_mon_role()) = 'superadmin');

create policy "h membres lecture" on public.h_membres for select to authenticated
  using ((select public.h_mon_role()) = 'superadmin' or (espace = (select public.h_mon_espace()) and role <> 'superadmin') or email = (select public.h_mon_email()));
create policy "h membres superadmin" on public.h_membres for all to authenticated
  using ((select public.h_mon_role()) = 'superadmin') with check ((select public.h_mon_role()) = 'superadmin');
create policy "h equipe gere membres" on public.h_membres for all to authenticated
  using ((select public.h_mon_droit('equipe')) and espace = (select public.h_mon_espace()) and role <> 'superadmin' and ((select public.h_mon_role()) = 'pdg' or role <> 'pdg'))
  with check ((select public.h_mon_droit('equipe')) and espace = (select public.h_mon_espace()) and role <> 'superadmin' and ((select public.h_mon_role()) = 'pdg' or role <> 'pdg'));

-- ---------- Données de chaque établissement ----------
create table if not exists public.h_prospects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  espace text not null default public.h_mon_espace(),
  name text not null,
  fiche jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.h_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  espace text not null default public.h_mon_espace(),
  prospect_id uuid references public.h_prospects on delete cascade,
  date date not null,
  time text, canal text, action text not null, resultat text, montant numeric, duree numeric,
  prochaine_action text, date_relance date, heure_rappel text, objection text, modele text,
  note numeric, facture text, remise numeric, notes text,
  mode text, reference text, categorie text, fournisseur text, recu text,
  created_at timestamptz not null default now()
);
create table if not exists public.h_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  espace text not null default public.h_mon_espace(),
  type text not null default 'facture',
  numero text not null,
  prospect_id uuid references public.h_prospects on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.h_settings (
  espace text primary key default public.h_mon_espace(),
  user_id uuid default auth.uid() references auth.users on delete set null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists h_actions_espace_idx on public.h_actions (espace, date);
create index if not exists h_documents_espace_idx on public.h_documents (espace, type);
create index if not exists h_prospects_espace_idx on public.h_prospects (espace);
alter table public.h_prospects enable row level security;
alter table public.h_actions enable row level security;
alter table public.h_documents enable row level security;
alter table public.h_settings enable row level security;

create policy "h settings lecture" on public.h_settings for select to authenticated using (espace = (select public.h_mon_espace()));
create policy "h settings ajout" on public.h_settings for insert to authenticated with check (espace = (select public.h_mon_espace()) and (select public.h_mon_droit('reglages')));
create policy "h settings modif" on public.h_settings for update to authenticated using (espace = (select public.h_mon_espace()) and (select public.h_mon_droit('reglages'))) with check (espace = (select public.h_mon_espace()));

create policy "h documents lecture" on public.h_documents for select to authenticated using (espace = (select public.h_mon_espace()));
create policy "h documents ajout" on public.h_documents for insert to authenticated with check (espace = (select public.h_mon_espace()) and (select public.h_mon_role()) is not null);
create policy "h documents modif" on public.h_documents for update to authenticated using (espace = (select public.h_mon_espace())) with check (espace = (select public.h_mon_espace()));
create policy "h documents suppression" on public.h_documents for delete to authenticated using (espace = (select public.h_mon_espace()) and (select public.h_mon_droit('annuler')));

create policy "h actions lecture" on public.h_actions for select to authenticated
  using (espace = (select public.h_mon_espace()) and (action <> 'Dépense' or (select public.h_mon_droit('finances')) or (select public.h_mon_droit('depenses'))));
create policy "h actions ajout" on public.h_actions for insert to authenticated
  with check (espace = (select public.h_mon_espace()) and (select public.h_mon_role()) is not null and (action <> 'Dépense' or (select public.h_mon_droit('depenses'))));
create policy "h actions modif" on public.h_actions for update to authenticated
  using (espace = (select public.h_mon_espace()) and (action <> 'Dépense' or (select public.h_mon_droit('depenses'))))
  with check (espace = (select public.h_mon_espace()) and (action <> 'Dépense' or (select public.h_mon_droit('depenses'))));
create policy "h actions suppression" on public.h_actions for delete to authenticated
  using (espace = (select public.h_mon_espace()) and ((select public.h_mon_droit('annuler')) or (action = 'Dépense' and (select public.h_mon_droit('depenses')))));

create policy "h prospects lecture" on public.h_prospects for select to authenticated using (espace = (select public.h_mon_espace()));
create policy "h prospects ajout" on public.h_prospects for insert to authenticated with check (espace = (select public.h_mon_espace()) and (select public.h_mon_role()) is not null);
create policy "h prospects modif" on public.h_prospects for update to authenticated using (espace = (select public.h_mon_espace())) with check (espace = (select public.h_mon_espace()));
create policy "h prospects suppression" on public.h_prospects for delete to authenticated using (espace = (select public.h_mon_espace()) and (select public.h_mon_droit('annuler')));

-- Justificatifs de dépenses
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('h-recus', 'h-recus', false, 5242880, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;
create policy "h espace recus" on storage.objects for all to authenticated
  using (bucket_id = 'h-recus' and public.h_espace_du_compte((storage.foldername(name))[1]) = (select public.h_mon_espace()))
  with check (bucket_id = 'h-recus' and (storage.foldername(name))[1] = auth.uid()::text and (select public.h_mon_role()) is not null);

-- ---------- Comptes de départ ----------
insert into public.h_etablissements (id, nom, modules, ville) values
  ('demo', 'Hôtel Le Palmier (démo)', '{"hebergement": true, "restaurant": true, "bar": true}', 'Brazzaville')
on conflict (id) do nothing;
insert into public.h_membres (email, nom, role, espace) values
  ('superadmin@agence-elite.fr', 'Super administrateur', 'superadmin', 'demo'),
  ('demo@agence-elite.fr', 'Directeur (démo)', 'pdg', 'demo'),
  ('narcie.demo@agence-elite.fr', 'Grâce (réception, démo)', 'caisse', 'demo')
on conflict (email) do nothing;

-- ---------- Inscriptions ----------
-- Même projet Supabase que le logiciel magasin : on autorise aussi les e-mails de l'équipe des hôtels.
-- (Sur un projet neuf dédié aux hôtels, supprimer la ligne public.membres.)
create or replace function public.compte_unique()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from auth.users)
     and not exists (select 1 from public.membres where email = lower(new.email))
     and not exists (select 1 from public.h_membres where email = lower(new.email)) then
    raise exception 'Inscriptions fermées';
  end if;
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end;
$$;
