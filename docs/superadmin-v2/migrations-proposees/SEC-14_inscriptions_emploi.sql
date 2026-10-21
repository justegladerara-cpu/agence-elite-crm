-- SEC-14 · PROPOSITION, NON APPLIQUÉE. À passer seulement avec l'accord écrit du propriétaire,
-- selon supabase/README.md : sauvegarde, diagnostic, migration, contrôle.
--
-- Constat (lecture seule de la base CRM, 2026-10-21) : le déclencheur crm_single_owner sur auth.users accepte
-- toute inscription qui se déclare « app = emploi » (rôle candidat ou entreprise) et confirme son e-mail
-- d'office. N'importe qui peut donc créer un compte confirmé sur le projet du CRM avec l'adresse de son choix,
-- y compris une adresse qui ne lui appartient pas.
--
-- Changement proposé (additif, réversible) : les inscriptions Emploi restent ouvertes, mais leur e-mail n'est
-- plus confirmé d'office ; seule la liste private.inscriptions_autorisees garde la confirmation automatique.
-- Conséquence à décider : un candidat ou une entreprise devra cliquer le lien reçu par e-mail
-- (il faut que l'envoi d'e-mails de Supabase Auth soit configuré).

-- Diagnostic avant
select count(*) filter (where raw_user_meta_data->>'app' = 'emploi') as comptes_emploi,
       count(*) filter (where raw_user_meta_data->>'app' = 'emploi' and email_confirmed_at is not null) as emploi_confirmes
from auth.users;

create or replace function public.crm_single_owner()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  autorise boolean := exists (select 1 from private.inscriptions_autorisees a where a.email = lower(new.email));
begin
  if exists (select 1 from auth.users u where lower(u.email) = lower(new.email)) then
    raise exception 'Inscriptions fermées';
  end if;
  if not autorise
     and not (coalesce(new.raw_user_meta_data->>'app', '') = 'emploi'
              and coalesce(new.raw_user_meta_data->>'role', '') in ('candidat', 'entreprise')) then
    raise exception 'Inscriptions fermées';
  end if;
  -- Confirmation automatique réservée aux adresses autorisées (SEC-14)
  if autorise then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  end if;
  return new;
end;
$function$;

-- Contrôle après : la définition ne confirme plus que les adresses autorisées
select pg_get_functiondef('public.crm_single_owner()'::regprocedure) like '%if autorise then%' as corrige;

-- RETOUR ARRIÈRE (si besoin) : remettre la ligne « new.email_confirmed_at := coalesce(new.email_confirmed_at, now()); »
-- hors du « if autorise », c'est-à-dire la définition d'avant, copiée dans 07_SECURITY_REGISTER.md (SEC-14).
