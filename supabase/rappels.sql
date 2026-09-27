-- Rappels sur le téléphone (notifications) : abonnements des appareils, rappels à envoyer,
-- configuration privée du service (clés générées par la fonction « rappels », jamais exposées).

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  appareil text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own push" on public.push_subscriptions;
create policy "own push" on public.push_subscriptions for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

create table if not exists public.rappels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  quand timestamptz not null,
  titre text not null,
  corps text,
  url text,
  cle text not null,
  envoye boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, cle)
);
create index if not exists rappels_a_envoyer on public.rappels (quand) where not envoye;
alter table public.rappels enable row level security;
drop policy if exists "own rappels" on public.rappels;
create policy "own rappels" on public.rappels for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Configuration privée : lisible uniquement par le service (aucune règle d'accès pour les utilisateurs)
create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  vapid_public text,
  vapid_private text,
  cron_secret text not null default encode(extensions.gen_random_bytes(24), 'hex')
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;
insert into public.push_config (id) values (1) on conflict do nothing;

-- Toutes les 5 minutes : la fonction « rappels » envoie les rappels arrivés à échéance
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('envoyer-rappels') where exists (select 1 from cron.job where jobname = 'envoyer-rappels');
select cron.schedule(
  'envoyer-rappels',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://mylgnsuoppplmfaanyze.supabase.co/functions/v1/rappels',
       headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron', (select cron_secret from public.push_config where id = 1)),
       body := '{"action":"envoyer"}'::jsonb
     ) $$
);
