-- Documents et modèles d'Agence Elite modifiables dans le CRM (application « Documents »).
-- Les 58 modèles d'origine sont livrés avec l'application (public/documents/modeles.json).
-- Une ligne ici = un modèle modifié par l'espace (même clé) ou un nouveau modèle créé par l'utilisateur.
-- Sans ligne, le CRM affiche le modèle d'origine. Migration additive : aucune donnée existante n'est modifiée.

create table if not exists public.modeles_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  cle text not null check (cle ~ '^[a-z0-9-]{1,80}$'),
  titre text not null check (length(titre) between 1 and 200),
  categorie text not null default 'Mes modèles' check (length(categorie) <= 80),
  reference text check (reference is null or length(reference) <= 40),
  type text not null default 'modele' check (type in ('texte', 'modele', 'contrat')),
  contenu text not null default '' check (length(contenu) <= 200000),
  supprime boolean not null default false,
  modifie_le timestamptz not null default now(),
  modifie_par uuid default auth.uid()
);
create unique index if not exists modeles_documents_cle on public.modeles_documents (workspace_id, cle);

create or replace trigger rattacher_espace before insert or update of workspace_id on public.modeles_documents
  for each row execute function private.rattacher_espace();

alter table public.modeles_documents enable row level security;
create policy "membres lecture" on public.modeles_documents for select to authenticated
  using (workspace_id in (select private.mes_espaces()));
create policy "membres ajout" on public.modeles_documents for insert to authenticated
  with check (user_id = (select auth.uid()) and workspace_id in (select private.espaces_ecriture()));
create policy "membres modification" on public.modeles_documents for update to authenticated
  using (workspace_id in (select private.espaces_ecriture())) with check (workspace_id in (select private.espaces_ecriture()));
create policy "gestion suppression" on public.modeles_documents for delete to authenticated
  using (workspace_id in (select private.espaces_gestion()));
create policy "espace obligatoire" on public.modeles_documents as restrictive for all to authenticated
  using (workspace_id in (select private.mes_espaces())) with check (workspace_id is null or workspace_id in (select private.mes_espaces()));
create policy "double authentification" on public.modeles_documents as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));
revoke all on public.modeles_documents from anon;
