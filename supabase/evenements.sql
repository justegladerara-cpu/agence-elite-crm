-- Étape 4b : table `events` (append-only), écrite par la base elle-même à chaque action ou devis/facture.
-- Même correspondance que src/core/events.js. Une action supprimée n'efface pas l'événement : il est marqué annule.
-- Appliqué le 2026-09-29 (migration evenements) : 1439 événements d'actions + 184 de devis/factures, sommes des paiements identiques.
-- Lecture par les membres de l'espace ; aucune écriture depuis l'application.

create table if not exists public.events (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces on delete cascade,
  type text not null,
  date date,
  at timestamptz not null default now(),
  acteur uuid,
  module text not null,
  entite text not null,
  entite_id text,
  meta jsonb not null default '{}',
  correlation_id text,
  source text not null unique,
  annule boolean not null default false
);
create index if not exists events_espace on public.events (workspace_id, date desc);
create index if not exists events_correlation on public.events (correlation_id);
alter table public.events enable row level security;
drop policy if exists "evenements membres" on public.events;
create policy "evenements membres" on public.events for select to authenticated using (workspace_id in (select private.mes_espaces()));
drop policy if exists "double authentification" on public.events;
create policy "double authentification" on public.events as restrictive for all to authenticated using ((select private.mfa_ok())) with check ((select private.mfa_ok()));

create or replace function private.type_action(nom text) returns text language sql immutable set search_path = '' as $$
  select case nom
    when 'Ajout prospect' then 'prospect.created'
    when 'Premier contact' then 'prospect.contacted' when 'Relance' then 'prospect.contacted' when 'Échange / suivi' then 'prospect.contacted'
    when 'Qualification' then 'prospect.qualified'
    when 'Audit réalisé' then 'prospect.demo' when 'Loom envoyé' then 'prospect.demo' when 'Démo présentée' then 'prospect.demo'
    when 'RDV' then 'appointment.created'
    when 'Proposition envoyée' then 'proposal.sent'
    when 'Signature' then 'client.won' when 'Intervention' then 'client.won'
    when 'Perdu' then 'prospect.lost'
    when 'Paiement reçu' then 'payment.received'
    when 'Vente additionnelle' then 'client.upsell'
    when 'Dépense' then 'expense.created'
    when 'Commande boutique' then 'store.order'
    when 'Demande site web' then 'site.contact'
  end
$$;

create or replace function private.module_du_type(t text) returns text language sql immutable set search_path = '' as $$
  select case split_part(t, '.', 1) when 'payment' then 'facturation' when 'quote' then 'facturation' when 'invoice' then 'facturation'
    when 'expense' then 'charges' when 'store' then 'store' when 'site' then 'site' else 'commercial' end
$$;

-- Date lue dans un JSON : null si invalide (jamais d'erreur)
create or replace function private.date_sure(v text) returns date language plpgsql stable set search_path = '' as $$
begin
  return nullif(v, '')::date;
exception when others then return null;
end $$;

create or replace function private.evenement_action() returns trigger language plpgsql security definer set search_path = '' as $$
declare t text; argent boolean;
begin
  if tg_op = 'DELETE' then
    update public.events set annule = true where source = 'action:' || old.id;
    return null;
  end if;
  t := private.type_action(new.action);
  if t is null then return null; end if;
  argent := t in ('payment.received', 'expense.created');
  insert into public.events (workspace_id, type, date, at, acteur, module, entite, entite_id, meta, correlation_id, source)
  values (new.workspace_id, t, new.date, coalesce(new.created_at, now()), new.user_id, private.module_du_type(t),
    case when not argent then 'prospect' when t = 'payment.received' then 'paiement' else 'depense' end,
    case when argent then new.id::text else new.prospect_id::text end,
    jsonb_build_object('action', new.action, 'canal', new.canal, 'montant', new.montant, 'facture', new.facture, 'prospectId', new.prospect_id),
    case when new.facture is not null and new.facture <> '' then 'facture:' || new.facture when new.prospect_id is not null then 'prospect:' || new.prospect_id end,
    'action:' || new.id)
  on conflict (source) do nothing;
  return null;
-- Le journal d'événements ne doit jamais bloquer l'enregistrement de l'utilisateur
exception when others then
  raise warning 'événement non écrit : %', sqlerrm;
  return null;
end $$;

create or replace function private.evenement_document() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    update public.events set annule = true where source = 'document:' || old.id;
    return null;
  end if;
  if new.type not in ('devis', 'facture') then return null; end if;
  insert into public.events (workspace_id, type, date, at, acteur, module, entite, entite_id, meta, correlation_id, source)
  values (new.workspace_id, case when new.type = 'devis' then 'quote.created' else 'invoice.created' end,
    coalesce(private.date_sure(new.data ->> 'date'), new.created_at::date), coalesce(new.created_at, now()), new.user_id, 'facturation', new.type, new.id::text,
    jsonb_build_object('numero', new.numero, 'prospectId', new.prospect_id, 'devisId', new.data ->> 'devisId'),
    case when new.type = 'facture' then 'facture:' || new.numero when new.prospect_id is not null then 'prospect:' || new.prospect_id end,
    'document:' || new.id)
  on conflict (source) do nothing;
  return null;
-- Le journal d'événements ne doit jamais bloquer l'enregistrement de l'utilisateur
exception when others then
  raise warning 'événement non écrit : %', sqlerrm;
  return null;
end $$;
revoke all on function private.evenement_action(), private.evenement_document() from public, anon, authenticated;

drop trigger if exists evenement on public.actions;
create trigger evenement after insert or delete on public.actions for each row execute function private.evenement_action();
drop trigger if exists evenement on public.documents;
create trigger evenement after insert or delete on public.documents for each row execute function private.evenement_document();

-- Historique : les lignes déjà en base produisent leurs événements (idempotent grâce à source unique)
insert into public.events (workspace_id, type, date, at, acteur, module, entite, entite_id, meta, correlation_id, source)
select a.workspace_id, t, a.date, coalesce(a.created_at, now()), a.user_id, private.module_du_type(t),
  case when t not in ('payment.received', 'expense.created') then 'prospect' when t = 'payment.received' then 'paiement' else 'depense' end,
  case when t in ('payment.received', 'expense.created') then a.id::text else a.prospect_id::text end,
  jsonb_build_object('action', a.action, 'canal', a.canal, 'montant', a.montant, 'facture', a.facture, 'prospectId', a.prospect_id),
  case when a.facture is not null and a.facture <> '' then 'facture:' || a.facture when a.prospect_id is not null then 'prospect:' || a.prospect_id end,
  'action:' || a.id
from public.actions a cross join lateral (select private.type_action(a.action) as t) x
where t is not null
on conflict (source) do nothing;

insert into public.events (workspace_id, type, date, at, acteur, module, entite, entite_id, meta, correlation_id, source)
select d.workspace_id, case when d.type = 'devis' then 'quote.created' else 'invoice.created' end,
  coalesce(private.date_sure(d.data ->> 'date'), d.created_at::date), coalesce(d.created_at, now()), d.user_id, 'facturation', d.type, d.id::text,
  jsonb_build_object('numero', d.numero, 'prospectId', d.prospect_id, 'devisId', d.data ->> 'devisId'),
  case when d.type = 'facture' then 'facture:' || d.numero when d.prospect_id is not null then 'prospect:' || d.prospect_id end,
  'document:' || d.id
from public.documents d where d.type in ('devis', 'facture')
on conflict (source) do nothing;
