-- BROUILLON — NON APPLIQUÉ. Aucune base ne contient ce schéma.
-- Socle de la plateforme : client → établissement → solution.

create table clients (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  pays text,
  devise text not null default 'XAF',
  statut text not null default 'actif' check (statut in ('actif','suspendu','archive')),
  created_at timestamptz not null default now()
);

create table solutions (
  id text primary key,                 -- 'hotel', 'restaurant', 'commerce'
  nom text not null,
  statut text not null default 'active'
);

create table modules (
  id text primary key,                 -- 'caisse', 'articles', 'stock'…
  nom text not null,
  socle boolean not null default false -- true = toujours présent
);

create table solution_modules (
  solution_id text references solutions(id),
  module_id text references modules(id),
  par_defaut boolean not null default false,
  primary key (solution_id, module_id)
);

create table etablissements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id),
  solution_id text not null references solutions(id),
  nom text not null,
  identite jsonb not null default '{}',  -- logo, couleurs, adresse, mentions
  statut text not null default 'actif' check (statut in ('actif','suspendu','archive')),
  created_at timestamptz not null default now()
);

create table etablissement_membres (
  etablissement_id uuid references etablissements(id),
  user_id uuid references auth.users(id),
  role text not null check (role in ('gerant','admin','employe','comptable','lecteur')),
  droits jsonb not null default '{}',
  primary key (etablissement_id, user_id)
);

create table client_membres (
  client_id uuid references clients(id),
  user_id uuid references auth.users(id),
  role text not null check (role in ('dirigeant','lecteur')),
  primary key (client_id, user_id)
);

create table etablissement_modules (
  etablissement_id uuid references etablissements(id),
  module text not null references modules(id),  -- doit faire partie de la solution de l'établissement
  actif boolean not null default true,
  config jsonb not null default '{}',
  primary key (etablissement_id, module)
);

create table etablissement_parametres (
  etablissement_id uuid primary key references etablissements(id),
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table plateforme_admins (
  user_id uuid primary key references auth.users(id),
  role text not null check (role in ('superadmin','support'))
);
-- À ajouter à l'implémentation : RLS sur chaque table
-- (établissement + adhésion + rôle), trigger de rattachement,
-- journal d'événements et audit avec etablissement_id.
