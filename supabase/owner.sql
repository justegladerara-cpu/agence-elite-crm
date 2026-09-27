-- Appliqué le 2026-09-27 : seul justegladerara@gmail.com peut créer un compte, une seule fois,
-- et ce compte est confirmé à la création (pas d'e-mail de validation).
create or replace function public.crm_single_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if lower(new.email) <> 'justegladerara@gmail.com' or exists (select 1 from auth.users) then
    raise exception 'Inscriptions fermées';
  end if;
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end;
$$;
revoke execute on function public.crm_single_owner() from public, anon, authenticated;
drop trigger if exists crm_single_owner on auth.users;
create trigger crm_single_owner before insert on auth.users
  for each row execute function public.crm_single_owner();
