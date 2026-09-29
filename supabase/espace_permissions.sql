-- Step 6B : l'espace de travail fait foi (Espace → Adhésion → Rôle), plus aucune règle « user_id » qui le contourne.
-- Ajout et remplacement de règles seulement : aucune ligne supprimée, aucune colonne retirée.
--   1. Réglages de l'espace : une ligne par espace, lue par ses membres, modifiée par propriétaire/admin (RPC enregistrer_reglages).
--   2. Journal d'audit rattaché à l'espace (colonne workspace_id), l'auteur reste dans `acteur` ; lu par propriétaire/admin.
--   3. Anciennes règles « own … » (user_id) retirées : un membre rétrogradé lecteur ne peut plus modifier ses anciennes fiches.
--      Un membre garde le droit de supprimer ce qu'il a créé ; propriétaire/admin suppriment tout.
--   4. Site et boutique gérés par propriétaire/admin de l'espace (au lieu du seul auteur).
--   5. Écrire dans un espace où l'on est lecteur (ou plus membre) est refusé au lieu d'atterrir dans un autre espace.
-- Rôles : proprietaire, admin (tout), membre (lire, créer, modifier ; supprimer ses propres éléments), lecteur (lire).
-- Appliqué le 2026-09-29 (migration espace_permissions). Retour arrière : voir la fin du fichier.

-- 1. Réglages de l'espace
create unique index if not exists settings_workspace_unique on public.settings (workspace_id);

create or replace function public.enregistrer_reglages(w uuid, p_data jsonb) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.mfa_ok()) then raise exception 'Double authentification requise' using errcode = '42501'; end if;
  if w is null or w not in (select private.espaces_gestion()) then
    raise exception 'Seuls le propriétaire et les administrateurs modifient les réglages de cet espace' using errcode = '42501';
  end if;
  update public.settings set data = p_data, updated_at = now() where workspace_id = w;
  if not found then
    insert into public.settings (user_id, workspace_id, data, updated_at)
    select owner_id, w, p_data, now() from public.workspaces where id = w
    on conflict (user_id) do nothing;
    if not found then raise exception 'Réglages de cet espace introuvables'; end if;
  end if;
end $$;
revoke all on function public.enregistrer_reglages(uuid, jsonb) from public, anon;
grant execute on function public.enregistrer_reglages(uuid, jsonb) to authenticated;

-- 2. Journal d'audit rattaché à l'espace
alter table public.audit_log add column if not exists workspace_id uuid;
create index if not exists audit_log_espace on public.audit_log (workspace_id, at desc);
update public.audit_log set workspace_id = case when table_name = 'workspaces' then entite_id::uuid else private.espace_de(proprietaire) end
where workspace_id is null;

create or replace function private.journaliser() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  champs text[];
  h json;
  prop uuid;
begin
  if tg_op = 'UPDATE' then
    select array_agg(e.key order by e.key) into champs from jsonb_each(r) e where to_jsonb(old) -> e.key is distinct from e.value;
    if champs is null then return null; end if;
  end if;
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then h := null;
  end;
  prop := coalesce(r ->> 'user_id', r ->> 'owner_id')::uuid;
  insert into public.audit_log (acteur, role, operation, table_name, entite_id, proprietaire, champs, appareil, ip, workspace_id)
  values ((select auth.uid()), coalesce((select auth.role()), current_user), lower(tg_op), tg_table_name,
    coalesce(r ->> 'id', r ->> 'workspace_id', r ->> 'user_id'), prop, champs,
    left(h ->> 'user-agent', 200), split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1),
    coalesce((r ->> 'workspace_id')::uuid, case when tg_table_name = 'workspaces' then (r ->> 'id')::uuid end, private.espace_de(prop)));
  return null;
end $$;
revoke all on function private.journaliser() from public, anon, authenticated;

drop policy if exists "journal proprietaire" on public.audit_log;
drop policy if exists "journal espace" on public.audit_log;
create policy "journal espace" on public.audit_log for select to authenticated using (workspace_id in (select private.espaces_gestion()));

-- 3. Données métier : plus de règle « own » ; suppression de ses propres éléments pour un membre
drop policy if exists "own prospects" on public.prospects;
drop policy if exists "own actions" on public.actions;
drop policy if exists "own documents" on public.documents;
drop policy if exists "own settings" on public.settings;
do $$
declare t text;
begin
  foreach t in array array['prospects', 'actions', 'documents'] loop
    execute format('drop policy if exists "membres suppression propre" on public.%I', t);
    execute format('create policy "membres suppression propre" on public.%I for delete to authenticated using (user_id = (select auth.uid()) and workspace_id in (select private.espaces_ecriture()))', t);
  end loop;
end $$;

-- 4. Site et boutique : propriétaire/admin de l'espace
drop policy if exists "demandes proprietaire" on public.site_demandes;
drop policy if exists "visites proprietaire" on public.site_visites;
drop policy if exists "cles proprietaire" on public.store_cles;
drop policy if exists "commandes proprietaire" on public.store_commandes;
drop policy if exists "produits proprietaire" on public.store_produits;
do $$
declare t text;
begin
  foreach t in array array['site_demandes', 'site_visites', 'store_cles', 'store_commandes', 'store_produits'] loop
    execute format('drop policy if exists "gestion ecriture" on public.%I', t);
    execute format('create policy "gestion ecriture" on public.%I for all to authenticated using (workspace_id in (select private.espaces_gestion())) with check (workspace_id in (select private.espaces_gestion()))', t);
  end loop;
end $$;
drop policy if exists "catalogue public" on public.store_produits;
create policy "catalogue public" on public.store_produits for select to anon, authenticated using (actif and user_id = (select private.site_proprietaire()));

-- 5. Écriture dans un espace sans droit : refus explicite (le propriétaire écrit toujours dans le sien)
create or replace function private.rattacher_espace() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.workspace_id is null or (select auth.uid()) is null then
      new.workspace_id := private.espace_de(new.user_id);
    elsif not exists (select 1 from public.workspace_members m where m.workspace_id = new.workspace_id and m.user_id = (select auth.uid()) and m.role in ('proprietaire', 'admin', 'membre')) then
      raise exception 'Lecture seule : pas le droit d''ajouter dans cet espace' using errcode = '42501';
    end if;
  else
    new.workspace_id := old.workspace_id;
  end if;
  return new;
end $$;

-- Retour arrière (aucune donnée supprimée) :
--   recréer les règles « own prospects/actions/documents/settings » (schema.sql), « journal proprietaire » (audit.sql),
--   « demandes/visites/cles/commandes/produits proprietaire » et « catalogue public » (site.sql, store.sql, espaces.sql) ;
--   supprimer les règles « membres suppression propre », « gestion ecriture », « journal espace » ;
--   réappliquer private.journaliser (audit.sql) et private.rattacher_espace (espace_donnees.sql) ;
--   la colonne audit_log.workspace_id, l'index unique et la fonction enregistrer_reglages peuvent rester (sans effet).
