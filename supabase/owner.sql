-- Appliqué le 2026-09-27, élargi le 2026-09-28 : seuls justegladerara@gmail.com et le compte de démonstration
-- demo@agence-elite.fr peuvent exister, chacun une seule fois, confirmés à la création (pas d'e-mail de validation).
create or replace function public.crm_single_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if lower(new.email) not in ('justegladerara@gmail.com', 'demo@agence-elite.fr')
     or exists (select 1 from auth.users u where lower(u.email) = lower(new.email)) then
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
