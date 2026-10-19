-- Mission 01 (audit du 19/10/2026, SEC-01 / SEC-09) : double authentification des comptes internes du CRM.
--
-- Avant : private.mfa_ok() n'exigeait le code (aal2) que si le compte avait déjà un téléphone enrôlé (0 aujourd'hui),
-- et les fonctions de gestion des membres (inviter, changer de rôle, retirer, lister) ne l'appelaient pas du tout :
-- un mot de passe volé suffisait, même après activation du code.
-- Après :
--   * même règle qu'avant tant que le mode « obligatoire » est désactivé (aucun verrouillage possible) ;
--   * mode obligatoire : un compte INTERNE (membre d'un espace du CRM) sans téléphone enrôlé n'a plus accès aux
--     données ; il doit enrôler son téléphone (l'écran le lui propose). Les comptes Elite Emploi (candidats,
--     entreprises), qui ne sont membres d'aucun espace, ne sont pas concernés ;
--   * le mode obligatoire ne s'active que si TOUS les comptes internes ont déjà un téléphone vérifié ;
--   * gestion des membres : code exigé comme pour les données ;
--   * fonctions d'administration Elite Emploi : plus exécutables sans connexion (anon), défense en profondeur.
-- Non destructive : aucune donnée supprimée, aucun compte modifié.
-- Retour arrière : select public.crm_definir_mfa_obligatoire(false); (ou update private.securite_crm … en SQL),
-- puis, si besoin, réinstaller les anciennes définitions (supabase/double_auth.sql et l'historique Git).

create schema if not exists private;

create table if not exists private.securite_crm (
  id boolean primary key default true check (id),
  mfa_interne_obligatoire boolean not null default false,
  modifie_le timestamptz not null default now(),
  modifie_par uuid
);
insert into private.securite_crm default values on conflict (id) do nothing;
alter table private.securite_crm enable row level security;
revoke all on private.securite_crm from public, anon, authenticated;

-- Compte interne = membre d'au moins un espace du CRM (ce critère ne dépend pas des métadonnées modifiables
-- par l'utilisateur lui-même).
create or replace function private.est_compte_interne(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.workspace_members m where m.user_id = p_user)
$$;
revoke all on function private.est_compte_interne(uuid) from public, anon, authenticated;

create or replace function private.a_facteur_verifie(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.mfa_factors f where f.user_id = p_user and f.status::text = 'verified')
$$;
revoke all on function private.a_facteur_verifie(uuid) from public, anon, authenticated;

-- Même nom et même usage qu'avant (18 politiques restrictives « double authentification » et enregistrer_reglages).
create or replace function private.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
    or (
      not private.a_facteur_verifie((select auth.uid()))
      and (
        not coalesce((select s.mfa_interne_obligatoire from private.securite_crm s where s.id), false)
        or not private.est_compte_interne((select auth.uid()))
      )
    )
$$;
revoke all on function private.mfa_ok() from public, anon;
grant execute on function private.mfa_ok() to authenticated;

-- Gestion des membres : le code est exigé (les fonctions security definer ne passent pas par les politiques).
create or replace function private.verifier_gestion(w uuid, nouveau_role text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare mon_role text;
begin
  if not (select private.mfa_ok()) then raise exception 'Double authentification requise' using errcode = '42501'; end if;
  select role into mon_role from public.workspace_members where workspace_id = w and user_id = (select auth.uid());
  if mon_role is null or mon_role not in ('proprietaire', 'admin') then raise exception 'Seul le propriétaire ou un admin gère les membres'; end if;
  if nouveau_role is not null and nouveau_role not in ('admin', 'membre', 'lecteur') then raise exception 'Rôle inconnu'; end if;
  if nouveau_role = 'admin' and mon_role <> 'proprietaire' then raise exception 'Seul le propriétaire nomme un admin'; end if;
end $$;

create or replace function public.membres_espace(w uuid)
returns table(user_id uuid, email text, role text, en_attente boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, u.email::text, m.role, false from public.workspace_members m join auth.users u on u.id = m.user_id
  where m.workspace_id = w and w in (select private.mes_espaces()) and (select private.mfa_ok())
  union all
  select null, i.email, i.role, true from private.invitations i
  where i.workspace_id = w and i.acceptee_le is null and w in (select private.mes_espaces()) and (select private.mfa_ok())
$$;

-- État pour l'écran du CRM (aucune donnée sur les autres comptes).
create or replace function public.crm_etat_securite()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'interne', private.est_compte_interne((select auth.uid())),
    'aal', coalesce((select auth.jwt() ->> 'aal'), 'aal1'),
    'facteur_verifie', private.a_facteur_verifie((select auth.uid())),
    'mfa_obligatoire', coalesce((select s.mfa_interne_obligatoire from private.securite_crm s where s.id), false),
    'enrolement_requis', private.est_compte_interne((select auth.uid()))
      and not private.a_facteur_verifie((select auth.uid()))
      and coalesce((select s.mfa_interne_obligatoire from private.securite_crm s where s.id), false)
  )
$$;
revoke all on function public.crm_etat_securite() from public, anon;
grant execute on function public.crm_etat_securite() to authenticated;

-- Activer / désactiver le mode obligatoire : propriétaire d'un espace, validé par son code (aal2).
-- Garde-fou anti-verrouillage : refusé tant qu'un compte interne n'a pas de téléphone vérifié.
create or replace function public.crm_definir_mfa_obligatoire(p_obligatoire boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare sans_facteur integer;
begin
  if coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2' then
    raise exception 'Validez d''abord votre code de double authentification' using errcode = '42501';
  end if;
  if not exists (select 1 from public.workspace_members where user_id = (select auth.uid()) and role = 'proprietaire') then
    raise exception 'Réservé au propriétaire' using errcode = '42501';
  end if;
  if p_obligatoire is null then raise exception 'Choix obligatoire'; end if;
  select count(distinct m.user_id) into sans_facteur
  from public.workspace_members m where not private.a_facteur_verifie(m.user_id);
  if p_obligatoire and sans_facteur > 0 then
    raise exception '% compte(s) interne(s) sans double authentification : activation refusée pour éviter un verrouillage', sans_facteur;
  end if;
  update private.securite_crm set mfa_interne_obligatoire = p_obligatoire, modifie_le = now(), modifie_par = (select auth.uid()) where id;
  return jsonb_build_object('mfa_interne_obligatoire', p_obligatoire, 'comptes_sans_facteur', sans_facteur);
end $$;
revoke all on function public.crm_definir_mfa_obligatoire(boolean) from public, anon;
grant execute on function public.crm_definir_mfa_obligatoire(boolean) to authenticated;

-- SEC-09 : fonctions d'administration Elite Emploi fermées aux visiteurs non connectés (elles vérifient déjà le rôle
-- à l'intérieur ; ceci ajoute une défense en profondeur). Les fonctions publiques (offres, site, boutique) ne changent pas.
do $$
declare f text;
begin
  foreach f in array array[
    'public.emploi_admin_candidatures()',
    'public.emploi_admin_question(uuid, text, text[], integer, uuid)',
    'public.emploi_admin_reponses(uuid)',
    'public.emploi_decision(uuid, text)',
    'public.emploi_profils_recus()'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon', f);
      execute format('grant execute on function %s to authenticated', f);
    end if;
  end loop;
end $$;
