-- Double authentification : quand un compte a activé un code (TOTP), ses données ne sont lisibles qu'avec une session validée par ce code (aal2).
-- Politique « restrictive » : elle s'ajoute aux politiques existantes (chacun ne voit que ses données).
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
-- Dans un schéma non exposé par l'API : utilisable par les politiques, pas appelable de l'extérieur
create or replace function private.mfa_ok() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified')
$$;
revoke all on function private.mfa_ok() from public, anon;
grant execute on function private.mfa_ok() to authenticated;
drop policy if exists "double authentification" on public.actions;
create policy "double authentification" on public.actions as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
drop policy if exists "double authentification" on public.documents;
create policy "double authentification" on public.documents as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
drop policy if exists "double authentification" on public.prospects;
create policy "double authentification" on public.prospects as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
drop policy if exists "double authentification" on public.settings;
create policy "double authentification" on public.settings as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
drop policy if exists "double authentification" on public.rappels;
create policy "double authentification" on public.rappels as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
drop policy if exists "double authentification" on public.push_subscriptions;
create policy "double authentification" on public.push_subscriptions as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
drop policy if exists "double authentification" on public.store_cles;
create policy "double authentification" on public.store_cles as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
drop policy if exists "double authentification" on public.store_commandes;
create policy "double authentification" on public.store_commandes as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
drop policy if exists "double authentification" on public.store_produits;
create policy "double authentification" on public.store_produits as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
drop policy if exists "double authentification" on public.client_errors;
create policy "double authentification" on public.client_errors as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
