-- Step 6A : le journal `events` suit aussi les modifications (approche A : l'événement reflète l'état courant).
-- Ajout seulement : 2 colonnes, 2 fonctions remplacées, 2 triggers recréés. Aucune donnée supprimée.
-- Un UPDATE recalcule l'événement (version + 1) ; une ligne qui n'est plus un fait métier annule son événement ;
-- une ligne restaurée (même id après suppression) réactive son événement. Rien n'est écrit si rien n'a changé.
-- Le journal d'audit (audit_log) reste l'historique technique des corrections ; il n'est pas modifié.
-- Appliqué le 2026-09-29 (migration evenements_modifications). Retour arrière : voir la fin du fichier.

alter table public.events
  add column if not exists version int not null default 1,
  add column if not exists modifie_le timestamptz;

create or replace function private.evenement_action() returns trigger language plpgsql security definer set search_path = '' as $$
declare t text; argent boolean;
begin
  if tg_op = 'DELETE' then
    update public.events set annule = true, modifie_le = now() where source = 'action:' || old.id and not annule;
    return null;
  end if;
  t := private.type_action(new.action);
  if t is null then
    -- N'est pas (ou plus) un fait métier : l'événement éventuel est annulé
    update public.events set annule = true, version = version + 1, modifie_le = now() where source = 'action:' || new.id and not annule;
    return null;
  end if;
  argent := t in ('payment.received', 'expense.created');
  insert into public.events as e (workspace_id, type, date, at, acteur, module, entite, entite_id, meta, correlation_id, source)
  values (new.workspace_id, t, new.date, coalesce(new.created_at, now()), new.user_id, private.module_du_type(t),
    case when not argent then 'prospect' when t = 'payment.received' then 'paiement' else 'depense' end,
    case when argent then new.id::text else new.prospect_id::text end,
    jsonb_build_object('action', new.action, 'canal', new.canal, 'montant', new.montant, 'facture', new.facture, 'prospectId', new.prospect_id),
    case when new.facture is not null and new.facture <> '' then 'facture:' || new.facture when new.prospect_id is not null then 'prospect:' || new.prospect_id end,
    'action:' || new.id)
  on conflict (source) do update set
    workspace_id = excluded.workspace_id, type = excluded.type, date = excluded.date, module = excluded.module, entite = excluded.entite,
    entite_id = excluded.entite_id, meta = excluded.meta, correlation_id = excluded.correlation_id, annule = false,
    version = e.version + 1, modifie_le = now()
  where (e.workspace_id, e.type, e.date, e.module, e.entite, e.entite_id, e.meta, e.correlation_id, e.annule)
    is distinct from (excluded.workspace_id, excluded.type, excluded.date, excluded.module, excluded.entite, excluded.entite_id, excluded.meta, excluded.correlation_id, false);
  return null;
-- Le journal d'événements ne doit jamais bloquer l'enregistrement de l'utilisateur
exception when others then
  raise warning 'événement non écrit : %', sqlerrm;
  return null;
end $$;

create or replace function private.evenement_document() returns trigger language plpgsql security definer set search_path = '' as $$
declare t text;
begin
  if tg_op = 'DELETE' then
    update public.events set annule = true, modifie_le = now() where source = 'document:' || old.id and not annule;
    return null;
  end if;
  if new.type not in ('devis', 'facture') then
    update public.events set annule = true, version = version + 1, modifie_le = now() where source = 'document:' || new.id and not annule;
    return null;
  end if;
  t := case when new.type = 'devis' then 'quote.created' else 'invoice.created' end;
  insert into public.events as e (workspace_id, type, date, at, acteur, module, entite, entite_id, meta, correlation_id, source)
  values (new.workspace_id, t, coalesce(private.date_sure(new.data ->> 'date'), new.created_at::date), coalesce(new.created_at, now()), new.user_id, 'facturation', new.type, new.id::text,
    jsonb_build_object('numero', new.numero, 'prospectId', new.prospect_id, 'devisId', new.data ->> 'devisId'),
    case when new.type = 'facture' then 'facture:' || new.numero when new.prospect_id is not null then 'prospect:' || new.prospect_id end,
    'document:' || new.id)
  on conflict (source) do update set
    workspace_id = excluded.workspace_id, type = excluded.type, date = excluded.date, module = excluded.module, entite = excluded.entite,
    entite_id = excluded.entite_id, meta = excluded.meta, correlation_id = excluded.correlation_id, annule = false,
    version = e.version + 1, modifie_le = now()
  where (e.workspace_id, e.type, e.date, e.module, e.entite, e.entite_id, e.meta, e.correlation_id, e.annule)
    is distinct from (excluded.workspace_id, excluded.type, excluded.date, excluded.module, excluded.entite, excluded.entite_id, excluded.meta, excluded.correlation_id, false);
  return null;
exception when others then
  raise warning 'événement non écrit : %', sqlerrm;
  return null;
end $$;
revoke all on function private.evenement_action(), private.evenement_document() from public, anon, authenticated;

drop trigger if exists evenement on public.actions;
create trigger evenement after insert or update or delete on public.actions for each row execute function private.evenement_action();
drop trigger if exists evenement on public.documents;
create trigger evenement after insert or update or delete on public.documents for each row execute function private.evenement_document();

-- Rattrapage idempotent : réaligne les événements sur l'état courant (n'écrit que ce qui diffère)
insert into public.events as e (workspace_id, type, date, at, acteur, module, entite, entite_id, meta, correlation_id, source)
select a.workspace_id, t, a.date, coalesce(a.created_at, now()), a.user_id, private.module_du_type(t),
  case when t not in ('payment.received', 'expense.created') then 'prospect' when t = 'payment.received' then 'paiement' else 'depense' end,
  case when t in ('payment.received', 'expense.created') then a.id::text else a.prospect_id::text end,
  jsonb_build_object('action', a.action, 'canal', a.canal, 'montant', a.montant, 'facture', a.facture, 'prospectId', a.prospect_id),
  case when a.facture is not null and a.facture <> '' then 'facture:' || a.facture when a.prospect_id is not null then 'prospect:' || a.prospect_id end,
  'action:' || a.id
from public.actions a cross join lateral (select private.type_action(a.action) as t) x
where t is not null
on conflict (source) do update set
  workspace_id = excluded.workspace_id, type = excluded.type, date = excluded.date, module = excluded.module, entite = excluded.entite,
  entite_id = excluded.entite_id, meta = excluded.meta, correlation_id = excluded.correlation_id, annule = false,
  version = e.version + 1, modifie_le = now()
where (e.workspace_id, e.type, e.date, e.module, e.entite, e.entite_id, e.meta, e.correlation_id, e.annule)
  is distinct from (excluded.workspace_id, excluded.type, excluded.date, excluded.module, excluded.entite, excluded.entite_id, excluded.meta, excluded.correlation_id, false);

insert into public.events as e (workspace_id, type, date, at, acteur, module, entite, entite_id, meta, correlation_id, source)
select d.workspace_id, case when d.type = 'devis' then 'quote.created' else 'invoice.created' end,
  coalesce(private.date_sure(d.data ->> 'date'), d.created_at::date), coalesce(d.created_at, now()), d.user_id, 'facturation', d.type, d.id::text,
  jsonb_build_object('numero', d.numero, 'prospectId', d.prospect_id, 'devisId', d.data ->> 'devisId'),
  case when d.type = 'facture' then 'facture:' || d.numero when d.prospect_id is not null then 'prospect:' || d.prospect_id end,
  'document:' || d.id
from public.documents d where d.type in ('devis', 'facture')
on conflict (source) do update set
  workspace_id = excluded.workspace_id, type = excluded.type, date = excluded.date, module = excluded.module, entite = excluded.entite,
  entite_id = excluded.entite_id, meta = excluded.meta, correlation_id = excluded.correlation_id, annule = false,
  version = e.version + 1, modifie_le = now()
where (e.workspace_id, e.type, e.date, e.module, e.entite, e.entite_id, e.meta, e.correlation_id, e.annule)
  is distinct from (excluded.workspace_id, excluded.type, excluded.date, excluded.module, excluded.entite, excluded.entite_id, excluded.meta, excluded.correlation_id, false);

-- Retour arrière (aucune donnée supprimée) :
--   1. réappliquer private.evenement_action et private.evenement_document de supabase/evenements.sql ;
--   2. recréer les triggers `evenement` en « after insert or delete » ;
--   3. laisser les colonnes version et modifie_le (sans effet).
