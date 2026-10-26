#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
file="${1:?Usage: bash restore-check.sh /path/file.dump.age /path/offline-age-key.txt}"
key="${2:?Pass an age private-key file; do not copy it permanently to the VPS}"
test -s "$file" && test -s "$key"
db="dorsum_restore_$(date -u +%Y%m%d%H%M%S)"
trap 'echo "Test database retained: $db. Inspect and drop it after verification."' EXIT
docker compose exec -T db createdb -U dorsum_owner "$db"
age -d -i "$key" "$file" | docker compose exec -T db pg_restore -U dorsum_owner -d "$db" --no-owner --no-acl --exit-on-error
docker compose exec -T db psql -X -U dorsum_owner -d "$db" -v ON_ERROR_STOP=1 -c 'SELECT (SELECT count(*) FROM "User") AS users,(SELECT count(*) FROM "Appointment") AS appointments,(SELECT count(*) FROM "ClientCardImage") AS client_images,(SELECT count(*) FROM "ExpenseReceipt") AS receipts;'
echo "Archive restored to separate database. Also compare storage-check.mjs output and open a real image using a staging API."
