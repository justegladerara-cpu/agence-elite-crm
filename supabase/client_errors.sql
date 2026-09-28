-- Suivi des erreurs de l'application : chaque erreur JavaScript chez l'utilisateur est enregistrée ici
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users on delete cascade,
  message text not null,
  stack text,
  page text,
  agent text,
  version text,
  created_at timestamptz not null default now()
);
alter table public.client_errors enable row level security;
drop policy if exists "client_errors insert" on public.client_errors;
create policy "client_errors insert" on public.client_errors for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "client_errors lecture" on public.client_errors;
create policy "client_errors lecture" on public.client_errors for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "client_errors suppression" on public.client_errors;
create policy "client_errors suppression" on public.client_errors for delete to authenticated using (user_id = (select auth.uid()));
create index if not exists client_errors_user_date on public.client_errors (user_id, created_at desc);
