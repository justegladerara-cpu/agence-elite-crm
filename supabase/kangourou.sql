-- Logiciel de gestion de magasin (Le Kangourou) : base Supabase complète, à coller dans le SQL Editor d'un projet neuf.
-- Pour un autre client : remplacer les e-mails et le nom d'espace 'kangourou' en bas du fichier.

-- ---------- Tables ----------
create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  fiche jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  prospect_id uuid references public.prospects on delete cascade,
  date date not null,
  time text, canal text, action text not null, resultat text, montant numeric, duree numeric,
  prochaine_action text, date_relance date, heure_rappel text, objection text, modele text,
  note numeric, facture text, remise numeric, notes text,
  mode text, reference text, categorie text, fournisseur text, recu text,
  created_at timestamptz not null default now()
);
create table if not exists public.settings (
  user_id uuid default auth.uid() references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  type text not null default 'facture',
  numero text not null,
  prospect_id uuid references public.prospects on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists actions_prospect_idx on public.actions (prospect_id);
create index if not exists actions_date_idx on public.actions (date);
create index if not exists documents_prospect_idx on public.documents (prospect_id);

-- ---------- Équipe, rôles et espaces ----------
create table if not exists public.membres (
  email text primary key,
  nom text not null default '',
  role text not null default 'caisse' check (role in ('superadmin', 'pdg', 'caisse', 'comptable')),
  espace text not null default 'kangourou',
  created_at timestamptz not null default now()
);

create or replace function public.mon_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.membres where email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
$$;
create or replace function public.mon_espace()
returns text language sql stable security definer set search_path = '' as $$
  select espace from public.membres where email = lower(coalesce((select auth.jwt() ->> 'email'), ''))
$$;
create or replace function public.espace_du_compte(u text) returns text
language sql stable security definer set search_path = public, auth as $$
  select m.espace from auth.users a join public.membres m on lower(m.email) = lower(a.email) where a.id::text = u
$$;
revoke execute on function public.mon_role() from public, anon;
revoke execute on function public.mon_espace() from public, anon;
revoke execute on function public.espace_du_compte(text) from public, anon;
grant execute on function public.mon_role() to authenticated;
grant execute on function public.mon_espace() to authenticated;
grant execute on function public.espace_du_compte(text) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['prospects', 'actions', 'documents', 'settings'] loop
    execute format('alter table public.%I add column if not exists espace text not null default public.mon_espace()', t);
    execute format('create index if not exists %I on public.%I (espace)', t || '_espace_idx', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
alter table public.settings add primary key (espace);
alter table public.membres enable row level security;

-- ---------- Droits ----------
create policy "membres lisent" on public.membres for select to authenticated using ((select public.mon_role()) is not null);
create policy "admin gere membres" on public.membres for all to authenticated
  using ((select public.mon_role()) = 'superadmin') with check ((select public.mon_role()) = 'superadmin');

-- Réglages : tout le monde lit, seuls superadmin et PDG modifient
create policy "settings lecture" on public.settings for select to authenticated using (espace = (select mon_espace()));
create policy "settings ecriture" on public.settings for insert to authenticated with check (espace = (select mon_espace()) and (select mon_role()) in ('superadmin','pdg'));
create policy "settings modif" on public.settings for update to authenticated using (espace = (select mon_espace()) and (select mon_role()) in ('superadmin','pdg')) with check (espace = (select mon_espace()));

-- Ventes, factures, paiements : la caisse crée et modifie, mais ne supprime pas
do $$ declare t text; begin
  foreach t in array array['documents','actions','prospects'] loop
    execute format('create policy "%s lecture" on public.%I for select to authenticated using (espace = (select mon_espace()))', t, t);
    execute format('create policy "%s ajout" on public.%I for insert to authenticated with check (espace = (select mon_espace()) and (select mon_role()) is not null)', t, t);
    execute format('create policy "%s modif" on public.%I for update to authenticated using (espace = (select mon_espace())) with check (espace = (select mon_espace()))', t, t);
    execute format('create policy "%s suppression" on public.%I for delete to authenticated using (espace = (select mon_espace()) and (select mon_role()) in (''superadmin'',''pdg'',''comptable''))', t, t);
  end loop;
end $$;

-- Justificatifs de dépenses : chacun ne voit que ceux de son espace
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recus', 'recus', false, 5242880, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;
create policy "espace recus" on storage.objects for all to authenticated
  using (bucket_id = 'recus' and public.espace_du_compte((storage.foldername(name))[1]) = (select mon_espace()))
  with check (bucket_id = 'recus' and (storage.foldername(name))[1] = auth.uid()::text and (select mon_role()) is not null);

-- ---------- Inscriptions : uniquement les e-mails de l'équipe (confirmés d'office) ----------
create or replace function public.compte_unique()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from auth.users) and not exists (select 1 from public.membres where email = lower(new.email)) then
    raise exception 'Inscriptions fermées';
  end if;
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end;
$$;
revoke execute on function public.compte_unique() from public, anon, authenticated;
create trigger compte_unique before insert on auth.users for each row execute function public.compte_unique();

-- ---------- Comptes de départ (à adapter pour chaque client) ----------
insert into public.membres (email, nom, role, espace) values
  ('justegladerara@gmail.com', 'Juste (Agence Elite)', 'superadmin', 'kangourou'),
  ('admin@lekangourou.com', 'Achille KANGOU', 'pdg', 'kangourou'),
  ('demo@lekangourou.com', 'Compte démo', 'pdg', 'demo')
on conflict (email) do nothing;

-- ---------- Droits réglables par personne (ajouté après la V1 ; remplace les règles ci-dessus) ----------
alter table public.membres add column if not exists droits jsonb not null default '{}'::jsonb;
create or replace function public.droit_defaut(r text, d text) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when r in ('superadmin', 'pdg') then true
    when r = 'caisse' then d in ('vendre', 'remises', 'credit', 'articles')
    when r = 'comptable' then d in ('annuler', 'finances', 'depenses')
    else false end
$$;
create or replace function public.mon_droit(d text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select case when m.role = 'superadmin' then true else coalesce((m.droits ->> d)::boolean, public.droit_defaut(m.role, d)) end
       from public.membres m where m.email = lower(coalesce((select auth.jwt() ->> 'email'), ''))),
    false)
$$;
revoke execute on function public.mon_droit(text) from public, anon;
grant execute on function public.mon_droit(text) to authenticated;

drop policy if exists "documents ajout" on public.documents;
drop policy if exists "documents modif" on public.documents;
drop policy if exists "documents suppression" on public.documents;
create policy "documents ajout" on public.documents for insert to authenticated
  with check (espace = (select mon_espace()) and (select mon_role()) is not null and (type <> 'produit' or (select mon_droit('articles'))));
create policy "documents modif" on public.documents for update to authenticated
  using (espace = (select mon_espace()))
  with check (espace = (select mon_espace()) and (type <> 'produit' or (select mon_droit('articles'))));
create policy "documents suppression" on public.documents for delete to authenticated
  using (espace = (select mon_espace()) and (select mon_droit('annuler')));

drop policy if exists "actions lecture" on public.actions;
drop policy if exists "actions ajout" on public.actions;
drop policy if exists "actions modif" on public.actions;
drop policy if exists "actions suppression" on public.actions;
create policy "actions lecture" on public.actions for select to authenticated
  using (espace = (select mon_espace()) and (action <> 'Dépense' or (select mon_droit('finances')) or (select mon_droit('depenses'))));
create policy "actions ajout" on public.actions for insert to authenticated
  with check (espace = (select mon_espace()) and (select mon_role()) is not null and (action <> 'Dépense' or (select mon_droit('depenses'))));
create policy "actions modif" on public.actions for update to authenticated
  using (espace = (select mon_espace()) and (action <> 'Dépense' or (select mon_droit('depenses'))))
  with check (espace = (select mon_espace()) and (action <> 'Dépense' or (select mon_droit('depenses'))));
create policy "actions suppression" on public.actions for delete to authenticated
  using (espace = (select mon_espace()) and ((select mon_droit('annuler')) or (action = 'Dépense' and (select mon_droit('depenses')))));

drop policy if exists "prospects suppression" on public.prospects;
create policy "prospects suppression" on public.prospects for delete to authenticated
  using (espace = (select mon_espace()) and (select mon_droit('annuler')));

drop policy if exists "settings ecriture" on public.settings;
drop policy if exists "settings modif" on public.settings;
create policy "settings ecriture" on public.settings for insert to authenticated with check (espace = (select mon_espace()) and (select mon_droit('reglages')));
create policy "settings modif" on public.settings for update to authenticated using (espace = (select mon_espace()) and (select mon_droit('reglages'))) with check (espace = (select mon_espace()));

drop policy if exists "membres lisent" on public.membres;
create policy "membres lisent" on public.membres for select to authenticated
  using ((select mon_role()) = 'superadmin' or (espace = (select mon_espace()) and role <> 'superadmin') or email = lower(coalesce((select auth.jwt() ->> 'email'), '')));
create policy "equipe gere membres" on public.membres for all to authenticated
  using ((select mon_droit('equipe')) and espace = (select mon_espace()) and role <> 'superadmin' and ((select mon_role()) = 'pdg' or role <> 'pdg'))
  with check ((select mon_droit('equipe')) and espace = (select mon_espace()) and role <> 'superadmin' and ((select mon_role()) = 'pdg' or role <> 'pdg'));

create or replace function public.ajuster_stock(lignes jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare l jsonb;
begin
  if (select public.mon_role()) is null then raise exception 'Accès refusé'; end if;
  for l in select * from jsonb_array_elements(lignes) loop
    update public.documents
       set data = jsonb_set(data, '{stock}', to_jsonb(coalesce(nullif(data ->> 'stock', '')::numeric, 0) + (l ->> 'delta')::numeric))
     where id = (l ->> 'id')::uuid and type = 'produit' and espace = public.mon_espace();
  end loop;
end;
$$;
revoke execute on function public.ajuster_stock(jsonb) from public, anon;
grant execute on function public.ajuster_stock(jsonb) to authenticated;
