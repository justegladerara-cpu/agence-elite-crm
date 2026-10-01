-- Amorçage d'une base neuve : les scripts site/store créent déjà leurs policies 2FA,
-- tandis que double_auth.sql ne peut être appliqué qu'après la création de toutes les tables.
-- Cette fonction est remplacée à l'identique par double_auth.sql plus loin dans l'ordre canonique.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.mfa_ok() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified')
$$;
revoke all on function private.mfa_ok() from public, anon;
grant execute on function private.mfa_ok() to authenticated;
