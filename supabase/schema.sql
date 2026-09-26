-- Agence Elite CRM : à coller une seule fois dans Supabase > SQL Editor > Run.

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  fiche jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  prospect_id uuid references public.prospects on delete cascade,
  date date not null,
  time text,
  canal text,
  action text not null,
  resultat text,
  montant numeric,
  duree numeric,
  prochaine_action text,
  date_relance date,
  heure_rappel text,
  objection text,
  modele text,
  note numeric,
  facture text,
  remise numeric,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists actions_prospect_idx on public.actions (prospect_id);
create index if not exists actions_date_idx on public.actions (date);

create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Sécurité : chaque utilisateur ne voit que ses propres données.
alter table public.prospects enable row level security;
alter table public.actions enable row level security;
alter table public.settings enable row level security;

drop policy if exists "own prospects" on public.prospects;
create policy "own prospects" on public.prospects for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own actions" on public.actions;
create policy "own actions" on public.actions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own settings" on public.settings;
create policy "own settings" on public.settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
