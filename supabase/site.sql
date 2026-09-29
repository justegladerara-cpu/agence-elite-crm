-- Site agence-elite : visites (sans cookie ni adresse IP) et demandes du formulaire de contact,
-- enregistrées pour le hub « Site web » du CRM. Le site n'écrit que par les deux fonctions ci-dessous.

create table if not exists public.site_visites (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  jour date not null default ((now() at time zone 'Africa/Brazzaville')::date),
  page text not null,
  source text,
  appareil text,
  created_at timestamptz not null default now()
);
create index if not exists site_visites_jour on public.site_visites (user_id, jour);

create table if not exists public.site_demandes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nom text not null,
  entreprise text,
  tel text not null,
  email text,
  solution text,
  message text,
  canal text,
  page text,
  prospect_id uuid references public.prospects (id) on delete set null,
  traitee boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists site_demandes_date on public.site_demandes (user_id, created_at desc);

alter table public.site_visites enable row level security;
alter table public.site_demandes enable row level security;
drop policy if exists "visites proprietaire" on public.site_visites;
create policy "visites proprietaire" on public.site_visites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "demandes proprietaire" on public.site_demandes;
create policy "demandes proprietaire" on public.site_demandes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "double authentification" on public.site_visites;
create policy "double authentification" on public.site_visites as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
drop policy if exists "double authentification" on public.site_demandes;
create policy "double authentification" on public.site_demandes as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));

-- Une page vue : chemin, site d'origine (nom de domaine seulement) et type d'appareil. 30 000 par jour au plus.
create or replace function public.site_visite(p_page text, p_source text default null, p_appareil text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  proprio uuid := '759b0b53-9fa9-4394-a2cd-beccce1a05d0';
  v_jour date := (now() at time zone 'Africa/Brazzaville')::date;
begin
  if (select count(*) from site_visites where user_id = proprio and jour = v_jour) >= 30000 then return; end if;
  insert into site_visites (user_id, jour, page, source, appareil)
  values (proprio, v_jour, left(coalesce(nullif(trim(p_page), ''), '/'), 200), nullif(left(trim(coalesce(p_source, '')), 120), ''),
    case when p_appareil in ('mobile', 'ordinateur', 'tablette') then p_appareil end);
end $$;
revoke all on function public.site_visite(text, text, text) from public;
grant execute on function public.site_visite(text, text, text) to anon, authenticated;

-- Demande du formulaire de contact : enregistrée, rattachée à une fiche (créée si le téléphone est inconnu)
-- avec une action « Demande site web ». Anti-spam : 5 par heure et par téléphone, 60 par heure au total.
create or replace function public.site_contact(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proprio uuid := '759b0b53-9fa9-4394-a2cd-beccce1a05d0';
  v_nom text := left(trim(coalesce(p->>'nom', '')), 120);
  v_tel text := left(trim(coalesce(p->>'tel', '')), 40);
  v_email text := nullif(left(trim(coalesce(p->>'email', '')), 160), '');
  v_entreprise text := nullif(left(trim(coalesce(p->>'entreprise', '')), 160), '');
  v_solution text := nullif(left(trim(coalesce(p->>'solution', '')), 120), '');
  v_message text := left(trim(coalesce(p->>'message', '')), 3000);
  v_canal text := case when p->>'canal' in ('whatsapp', 'email') then p->>'canal' end;
  v_page text := nullif(left(trim(coalesce(p->>'page', '')), 200), '');
  v_ici timestamp := now() at time zone 'Africa/Brazzaville';
  pid uuid;
  did uuid;
begin
  if v_nom = '' or v_tel = '' or v_message = '' then raise exception 'Nom, téléphone et message obligatoires'; end if;
  if (select count(*) from site_demandes d where d.created_at > now() - interval '1 hour'
      and regexp_replace(d.tel, '\D', '', 'g') = regexp_replace(v_tel, '\D', '', 'g')) >= 5
     or (select count(*) from site_demandes d where d.created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Trop de demandes en peu de temps';
  end if;
  select pr.id into pid from prospects pr where pr.user_id = proprio
    and regexp_replace(coalesce(pr.fiche->>'telephone', ''), '\D', '', 'g') = regexp_replace(v_tel, '\D', '', 'g') limit 1;
  if pid is null then
    pid := gen_random_uuid();
    insert into prospects (id, user_id, name, fiche) values (pid, proprio, coalesce(v_entreprise, v_nom),
      jsonb_strip_nulls(jsonb_build_object('contact', v_nom, 'telephone', v_tel, 'whatsapp', v_tel, 'email', v_email, 'source', 'Site web')));
    insert into actions (user_id, prospect_id, date, time, canal, action) values (proprio, pid, v_ici::date, to_char(v_ici, 'HH24:MI'), 'Autre', 'Ajout prospect');
  end if;
  insert into actions (user_id, prospect_id, date, time, canal, action, notes)
  values (proprio, pid, v_ici::date, to_char(v_ici, 'HH24:MI'), 'Autre', 'Demande site web',
    left(concat_ws(' · ', v_solution, v_message), 1000));
  insert into site_demandes (user_id, nom, entreprise, tel, email, solution, message, canal, page, prospect_id)
  values (proprio, v_nom, v_entreprise, v_tel, v_email, v_solution, v_message, v_canal, v_page, pid)
  returning id into did;
  return jsonb_build_object('ok', true, 'id', did);
end $$;
revoke all on function public.site_contact(jsonb) from public;
grant execute on function public.site_contact(jsonb) to anon, authenticated;
