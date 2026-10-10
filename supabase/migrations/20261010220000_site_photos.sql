-- Photos du site vitrine modifiables depuis le CRM (hub « Site web » › Photos du site).
-- Une ligne par emplacement de photo remplacé (clé de site/data.mjs EMPLACEMENTS_PHOTOS) ; sans ligne, le site garde
-- sa photo d'origine. Le site lit la liste par site_photos_publiques() ; seul le propriétaire du site écrit, en double
-- authentification. Migration additive : aucune donnée existante n'est modifiée.

create table if not exists public.site_photos (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cle text not null check (cle ~ '^[a-z0-9-]{1,60}$'),
  url text not null check (url ~ '^https://' and length(url) <= 600),
  alt text check (alt is null or length(alt) <= 200),
  modifie_le timestamptz not null default now(),
  primary key (user_id, cle)
);

alter table public.site_photos enable row level security;
drop policy if exists "photos proprietaire" on public.site_photos;
create policy "photos proprietaire" on public.site_photos for all to authenticated
  using (user_id = (select auth.uid()) and user_id = (select private.site_proprietaire()))
  with check (user_id = (select auth.uid()) and user_id = (select private.site_proprietaire()));
drop policy if exists "double authentification" on public.site_photos;
create policy "double authentification" on public.site_photos as restrictive for all to authenticated
  using ((select private.mfa_ok())) with check ((select private.mfa_ok()));

-- Lecture publique pour le site : clé, adresse et texte des photos remplacées par le propriétaire du site.
create or replace function public.site_photos_publiques()
returns table (cle text, url text, alt text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.cle, p.url, p.alt from public.site_photos p where p.user_id = private.site_proprietaire() order by p.cle
$$;
revoke all on function public.site_photos_publiques() from public;
grant execute on function public.site_photos_publiques() to anon, authenticated;

-- Fichiers : bucket public (le site affiche les images), écriture par le propriétaire du site dans son dossier.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-photos', 'site-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "site photos select" on storage.objects;
create policy "site photos select" on storage.objects for select to authenticated
  using (bucket_id = 'site-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select auth.uid()) = (select private.site_proprietaire()) and (select private.mfa_ok()));
drop policy if exists "site photos insert" on storage.objects;
create policy "site photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select auth.uid()) = (select private.site_proprietaire()) and (select private.mfa_ok()));
drop policy if exists "site photos update" on storage.objects;
create policy "site photos update" on storage.objects for update to authenticated
  using (bucket_id = 'site-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select auth.uid()) = (select private.site_proprietaire()) and (select private.mfa_ok()));
drop policy if exists "site photos delete" on storage.objects;
create policy "site photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'site-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select auth.uid()) = (select private.site_proprietaire()) and (select private.mfa_ok()));
