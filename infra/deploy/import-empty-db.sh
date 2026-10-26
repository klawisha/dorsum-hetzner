#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
file="${1:?Usage: bash import-empty-db.sh /absolute/path/file.dump}"
test -s "$file"
docker compose up -d db
for attempt in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U dorsum_owner -d dorsum >/dev/null 2>&1; then break; fi
  sleep 1
done
count=$(docker compose exec -T db psql -X -U dorsum_owner -d dorsum -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
[[ "$count" = 0 ]] || { echo "Refusing import: database is not empty. Restore into a separate test database or a new server."; exit 1; }
docker compose exec -T db pg_restore -U dorsum_owner -d dorsum --no-owner --no-acl --exit-on-error < "$file"
echo "Imported into empty target. Keep Render read-only until validation and switch-over are complete."
