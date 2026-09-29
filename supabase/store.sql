-- Elite Store : boutique en ligne du site agence-elite.fr, gérée depuis le CRM.
-- Le site (visiteur anonyme) lit les produits actifs et passe commande via store_passer_commande() ;
-- le propriétaire du CRM gère produits, commandes et clés de licence.

create table if not exists public.store_produits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  slug text not null unique,
  categorie text not null,
  nom text not null,
  editeur text,
  resume text,
  description text,
  duree text,
  appareils text,
  inclus jsonb not null default '[]',
  prix numeric not null check (prix >= 0),
  prix_barre numeric,
  periode text not null default 'une fois',
  image text,
  livraison text not null default 'cle' check (livraison in ('cle', 'compte', 'service')),
  a_confirmer boolean not null default true,
  actif boolean not null default true,
  vedette boolean not null default false,
  ordre int not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.store_commandes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  numero text not null unique,
  client jsonb not null,
  lignes jsonb not null,
  total numeric not null,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'payee', 'livree', 'annulee')),
  mode_paiement text,
  demo boolean not null default false,
  prospect_id uuid references public.prospects on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  payee_le timestamptz,
  livree_le timestamptz
);

create table if not exists public.store_cles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  produit_id uuid not null references public.store_produits on delete cascade,
  cle text not null,
  commande_id uuid references public.store_commandes on delete set null,
  attribuee_le timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists store_cles_produit on public.store_cles (produit_id) where commande_id is null;
create index if not exists store_cles_commande on public.store_cles (commande_id);
create index if not exists store_commandes_user on public.store_commandes (user_id, created_at desc);
create index if not exists store_commandes_prospect on public.store_commandes (prospect_id);
create index if not exists store_produits_user on public.store_produits (user_id);

alter table public.store_produits enable row level security;
alter table public.store_commandes enable row level security;
alter table public.store_cles enable row level security;

drop policy if exists "catalogue public" on public.store_produits;
-- Seul le catalogue du propriétaire est public (un autre compte du CRM ne publie rien sur le site)
create policy "catalogue public" on public.store_produits for select to anon, authenticated
  using ((actif and user_id = (select private.site_proprietaire())) or user_id = (select auth.uid()));
drop policy if exists "produits proprietaire" on public.store_produits;
create policy "produits proprietaire" on public.store_produits for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "commandes proprietaire" on public.store_commandes;
create policy "commandes proprietaire" on public.store_commandes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "cles proprietaire" on public.store_cles;
create policy "cles proprietaire" on public.store_cles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Commande passée depuis le site. Les prix sont relus en base (le navigateur ne fixe jamais le montant).
-- Crée aussi la fiche client dans le CRM (ou retrouve celle qui a le même téléphone) et l'action « Commande boutique ».
create or replace function public.store_passer_commande(p_client jsonb, p_lignes jsonb, p_demo boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proprio uuid := private.site_proprietaire();
  l jsonb;
  pr record;
  q int;
  v_lignes jsonb := '[]';
  v_total numeric := 0;
  v_num text;
  pid uuid;
  v_nom text := left(trim(coalesce(p_client->>'nom', '')), 120);
  v_tel text := left(trim(coalesce(p_client->>'tel', '')), 40);
  v_email text := left(trim(coalesce(p_client->>'email', '')), 160);
  v_entreprise text := left(trim(coalesce(p_client->>'entreprise', '')), 160);
  v_paiement text := nullif(left(coalesce(p_client->>'paiement', ''), 40), '');
  v_ici timestamp := now() at time zone 'Africa/Brazzaville';
begin
  if v_nom = '' or v_tel = '' then raise exception 'Nom et téléphone obligatoires'; end if;
  -- Anti-spam : 5 commandes par heure et par téléphone, 60 par heure au total
  if (select count(*) from store_commandes sc where sc.created_at > now() - interval '1 hour'
      and regexp_replace(sc.client->>'tel', '\D', '', 'g') = regexp_replace(v_tel, '\D', '', 'g')) >= 5
     or (select count(*) from store_commandes sc where sc.created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Trop de commandes en peu de temps : réessaie dans une heure ou écris-nous sur WhatsApp.';
  end if;
  if jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) = 0 or jsonb_array_length(p_lignes) > 30 then
    raise exception 'Panier invalide';
  end if;
  for l in select * from jsonb_array_elements(p_lignes) loop
    select sp.id, sp.slug, sp.nom, sp.prix, sp.periode, sp.livraison into pr
      from store_produits sp where sp.slug = l->>'slug' and sp.actif and sp.user_id = proprio;
    if not found then raise exception 'Produit indisponible : %', l->>'slug'; end if;
    q := greatest(1, least(50, coalesce((l->>'qte')::int, 1)));
    v_lignes := v_lignes || jsonb_build_object('produit_id', pr.id, 'slug', pr.slug, 'nom', pr.nom, 'prix', pr.prix, 'periode', pr.periode, 'qte', q, 'livraison', pr.livraison);
    v_total := v_total + pr.prix * q;
  end loop;

  loop
    v_num := 'CMD-' || to_char(v_ici, 'YYMMDD') || '-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from store_commandes sc where sc.numero = v_num);
  end loop;

  if not p_demo then
    select p.id into pid from prospects p where p.user_id = proprio
      and regexp_replace(coalesce(p.fiche->>'telephone', ''), '\D', '', 'g') = regexp_replace(v_tel, '\D', '', 'g') limit 1;
    if pid is null then
      pid := gen_random_uuid();
      insert into prospects (id, user_id, name, fiche) values (pid, proprio, coalesce(nullif(v_entreprise, ''), v_nom),
        jsonb_strip_nulls(jsonb_build_object('contact', v_nom, 'telephone', v_tel, 'whatsapp', v_tel, 'email', nullif(v_email, ''), 'source', 'Boutique en ligne')));
      insert into actions (user_id, prospect_id, date, canal, action) values (proprio, pid, v_ici::date, 'Autre', 'Ajout prospect');
    end if;
    insert into actions (user_id, prospect_id, date, time, canal, action, montant, notes)
    values (proprio, pid, v_ici::date, to_char(v_ici, 'HH24:MI'), 'Autre', 'Commande boutique', v_total,
      'Commande ' || v_num || ' : ' || (select string_agg((x->>'qte') || ' × ' || (x->>'nom'), ', ') from jsonb_array_elements(v_lignes) x));
  end if;

  insert into store_commandes (user_id, numero, client, lignes, total, statut, mode_paiement, demo, prospect_id, payee_le)
  values (proprio, v_num, jsonb_build_object('nom', v_nom, 'tel', v_tel, 'email', v_email, 'entreprise', v_entreprise), v_lignes, v_total,
    case when v_paiement = 'carte_simulation' then 'payee' else 'en_attente' end,
    v_paiement, p_demo, pid,
    case when v_paiement = 'carte_simulation' then now() end);

  return jsonb_build_object('numero', v_num, 'total', v_total, 'lignes', v_lignes);
end $$;

revoke all on function public.store_passer_commande(jsonb, jsonb, boolean) from public;
grant execute on function public.store_passer_commande(jsonb, jsonb, boolean) to anon, authenticated;
