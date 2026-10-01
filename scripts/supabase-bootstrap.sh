#!/usr/bin/env bash
# Reconstruit le schéma courant sur une base Supabase vide. Refuse une base déjà initialisée.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
ORDER="$ROOT/supabase/migrations/legacy-order.txt"
: "${DATABASE_URL:?Définis DATABASE_URL avec une URL PostgreSQL directe vers la base Supabase vide.}"

if [[ $(psql "$DATABASE_URL" -XAtqc "select to_regclass('public.prospects') is not null") == t ]]; then
  echo "Refus : public.prospects existe déjà. Pour une base existante, applique seulement les migrations versionnées manquantes." >&2
  exit 2
fi

while IFS= read -r file; do
  [[ -z "$file" || "$file" == \#* ]] && continue
  echo "==> supabase/$file"
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$ROOT/supabase/$file"
done < "$ORDER"

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "==> ${migration#"$ROOT/"}"
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$migration"
done

echo "Schéma installé. Crée maintenant le compte propriétaire, puis exécute supabase/store_catalogue.sql si nécessaire."
