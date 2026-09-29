-- Lot A : accès des membres à un espace de travail.
-- Appliqué le 2026-09-29 (migration acces_membres) après accord « vas-y lot A base ». Testé avant en transaction annulée (propriétaire, membre, lecteur, espace étranger, membre retiré).
-- Ajout seulement : les règles « mes lignes (user_id) » restent ; on ajoute des règles par espace selon le rôle,
-- et une barrière (restrictive) qui empêche toute ligne d'un espace dont on n'est pas membre.
-- Rôles : proprietaire / admin (gèrent), membre (écrit), lecteur (lit).
-- Retour arrière : voir la fin du fichier.

-- Espaces où l'utilisateur connecté peut écrire, ou gérer
create or replace function private.espaces_ecriture() returns setof uuid language sql stable security definer set search_path = '' as $$
  select workspace_id from public.workspace_members where user_id = (select auth.uid()) and role in ('proprietaire', 'admin', 'membre')
$$;
create or replace function private.espaces_gestion() returns setof uuid language sql stable security definer set search_path = '' as $$
  select workspace_id from public.workspace_members where user_id = (select auth.uid()) and role in ('proprietaire', 'admin')
$$;
revoke all on function private.espaces_ecriture(), private.espaces_gestion() from public, anon;
grant execute on function private.espaces_ecriture(), private.espaces_gestion() to authenticated;

-- Une ligne nouvelle va dans l'espace demandé si son auteur peut y écrire, sinon dans le sien ; elle ne change plus d'espace
create or replace function private.rattacher_espace() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.workspace_id is null or (select auth.uid()) is null
       or not exists (select 1 from public.workspace_members m where m.workspace_id = new.workspace_id and m.user_id = (select auth.uid()) and m.role in ('proprietaire', 'admin', 'membre')) then
      new.workspace_id := private.espace_de(new.user_id);
    end if;
  else
    new.workspace_id := old.workspace_id;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  -- Données de travail : lecture par tout membre, ajout/modification par membre+, suppression par admin+ (l'auteur garde sa règle user_id)
  foreach t in array array['prospects', 'actions', 'documents'] loop
    execute format('drop policy if exists "membres lecture" on public.%I', t);
    execute format('create policy "membres lecture" on public.%I for select to authenticated using (workspace_id in (select private.mes_espaces()))', t);
    execute format('drop policy if exists "membres ajout" on public.%I', t);
    execute format('create policy "membres ajout" on public.%I for insert to authenticated with check (user_id = (select auth.uid()) and workspace_id in (select private.espaces_ecriture()))', t);
    execute format('drop policy if exists "membres modification" on public.%I', t);
    execute format('create policy "membres modification" on public.%I for update to authenticated using (workspace_id in (select private.espaces_ecriture())) with check (workspace_id in (select private.espaces_ecriture()))', t);
    execute format('drop policy if exists "gestion suppression" on public.%I', t);
    execute format('create policy "gestion suppression" on public.%I for delete to authenticated using (workspace_id in (select private.espaces_gestion()))', t);
  end loop;
  -- Réglages, site, boutique : lecture par les membres, écriture inchangée (propriétaire)
  foreach t in array array['settings', 'site_demandes', 'site_visites', 'store_produits', 'store_commandes', 'store_cles'] loop
    execute format('drop policy if exists "membres lecture" on public.%I', t);
    execute format('create policy "membres lecture" on public.%I for select to authenticated using (workspace_id in (select private.mes_espaces()))', t);
  end loop;
  -- Barrière : jamais une ligne d'un espace dont on n'est pas membre (même une ligne qu'on a écrite avant d'être retiré).
  -- store_produits exclu : son catalogue public reste lisible par tous.
  foreach t in array array['prospects', 'actions', 'documents', 'settings', 'site_demandes', 'site_visites', 'store_commandes', 'store_cles'] loop
    execute format('drop policy if exists "espace obligatoire" on public.%I', t);
    execute format('create policy "espace obligatoire" on public.%I as restrictive for all to authenticated using (workspace_id is null or workspace_id in (select private.mes_espaces())) with check (workspace_id is null or workspace_id in (select private.mes_espaces()))', t);
  end loop;
end $$;

-- Invitations : un e-mail et un rôle ; l'adhésion est créée à l'inscription (ou tout de suite si le compte existe)
create table if not exists private.invitations (
  workspace_id uuid not null references public.workspaces on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('admin', 'membre', 'lecteur')),
  invite_par uuid,
  created_at timestamptz not null default now(),
  acceptee_le timestamptz,
  primary key (workspace_id, email)
);
revoke all on private.invitations from public, anon, authenticated;

create or replace function private.verifier_gestion(w uuid, nouveau_role text) returns void language plpgsql stable security definer set search_path = '' as $$
declare mon_role text;
begin
  select role into mon_role from public.workspace_members where workspace_id = w and user_id = (select auth.uid());
  if mon_role is null or mon_role not in ('proprietaire', 'admin') then raise exception 'Seul le propriétaire ou un admin gère les membres'; end if;
  if nouveau_role is not null and nouveau_role not in ('admin', 'membre', 'lecteur') then raise exception 'Rôle inconnu'; end if;
  if nouveau_role = 'admin' and mon_role <> 'proprietaire' then raise exception 'Seul le propriétaire nomme un admin'; end if;
end $$;
revoke all on function private.verifier_gestion(uuid, text) from public, anon;
grant execute on function private.verifier_gestion(uuid, text) to authenticated;

create or replace function public.inviter_membre(w uuid, p_email text, p_role text) returns text language plpgsql security definer set search_path = '' as $$
declare e text := lower(trim(p_email)); u uuid;
begin
  perform private.verifier_gestion(w, p_role);
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail invalide'; end if;
  select id into u from auth.users where lower(email) = e;
  if u is not null then
    if exists (select 1 from public.workspace_members where workspace_id = w and user_id = u) then raise exception 'Déjà membre de cet espace'; end if;
    insert into public.workspace_members (workspace_id, user_id, role) values (w, u, p_role);
    return 'ajoute';
  end if;
  insert into private.inscriptions_autorisees values (e) on conflict do nothing;
  insert into private.invitations (workspace_id, email, role, invite_par) values (w, e, p_role, (select auth.uid()))
  on conflict (workspace_id, email) do update set role = excluded.role, invite_par = excluded.invite_par, acceptee_le = null;
  return 'invite';
end $$;

create or replace function public.changer_role(w uuid, u uuid, p_role text) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.verifier_gestion(w, p_role);
  if u = (select auth.uid()) then raise exception 'Impossible de changer son propre rôle'; end if;
  if exists (select 1 from public.workspace_members where workspace_id = w and user_id = u and role = 'proprietaire') then raise exception 'Le propriétaire ne change pas de rôle'; end if;
  if (select role from public.workspace_members where workspace_id = w and user_id = u) = 'admin'
     and (select role from public.workspace_members where workspace_id = w and user_id = (select auth.uid())) <> 'proprietaire' then
    raise exception 'Seul le propriétaire modifie un admin';
  end if;
  update public.workspace_members set role = p_role where workspace_id = w and user_id = u;
  if not found then raise exception 'Membre introuvable'; end if;
end $$;

create or replace function public.retirer_membre(w uuid, u uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.verifier_gestion(w, null);
  if exists (select 1 from public.workspace_members where workspace_id = w and user_id = u and role = 'proprietaire') then raise exception 'Le propriétaire ne peut pas être retiré'; end if;
  if (select role from public.workspace_members where workspace_id = w and user_id = u) = 'admin'
     and (select role from public.workspace_members where workspace_id = w and user_id = (select auth.uid())) <> 'proprietaire' then
    raise exception 'Seul le propriétaire retire un admin';
  end if;
  delete from public.workspace_members where workspace_id = w and user_id = u;
end $$;

create or replace function public.annuler_invitation(w uuid, p_email text) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.verifier_gestion(w, null);
  -- Aucune suppression : l'invitation est marquée close
  update private.invitations set acceptee_le = '-infinity' where workspace_id = w and email = lower(trim(p_email)) and acceptee_le is null;
end $$;

-- Membres et invitations en attente d'un espace (visible par ses membres)
create or replace function public.membres_espace(w uuid) returns table (user_id uuid, email text, role text, en_attente boolean) language sql stable security definer set search_path = '' as $$
  select m.user_id, u.email::text, m.role, false from public.workspace_members m join auth.users u on u.id = m.user_id
  where m.workspace_id = w and w in (select private.mes_espaces())
  union all
  select null, i.email, i.role, true from private.invitations i
  where i.workspace_id = w and i.acceptee_le is null and w in (select private.mes_espaces())
$$;

revoke all on function public.inviter_membre(uuid, text, text), public.changer_role(uuid, uuid, text), public.retirer_membre(uuid, uuid), public.annuler_invitation(uuid, text), public.membres_espace(uuid) from public, anon;
grant execute on function public.inviter_membre(uuid, text, text), public.changer_role(uuid, uuid, text), public.retirer_membre(uuid, uuid), public.annuler_invitation(uuid, text), public.membres_espace(uuid) to authenticated;

-- À l'inscription : son propre espace (comme avant) + les espaces où il a été invité
create or replace function public.crm_nouvel_espace()
returns trigger language plpgsql security definer set search_path = '' as $$
declare w uuid;
begin
  insert into public.workspaces (nom, owner_id) values (coalesce(nullif(split_part(new.email, '@', 1), ''), 'Mon espace'), new.id) returning id into w;
  insert into public.workspace_members (workspace_id, user_id, role) values (w, new.id, 'proprietaire');
  insert into public.workspace_members (workspace_id, user_id, role)
  select i.workspace_id, new.id, i.role from private.invitations i where i.email = lower(new.email) and i.acceptee_le is null
  on conflict do nothing;
  update private.invitations set acceptee_le = now() where email = lower(new.email) and acceptee_le is null;
  return new;
end;
$$;

-- Retour arrière (rien n'est supprimé des données) :
--   drop policy "membres lecture" / "membres ajout" / "membres modification" / "gestion suppression" / "espace obligatoire" sur les tables ci-dessus ;
--   drop function public.inviter_membre, changer_role, retirer_membre, annuler_invitation, membres_espace ;
--   remettre private.rattacher_espace et public.crm_nouvel_espace de espace_donnees.sql / espaces.sql.
