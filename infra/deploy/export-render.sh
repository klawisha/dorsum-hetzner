#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
umask 077
test -s secrets/source-db.env || { echo "Create secrets/source-db.env with PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD and PGSSLMODE=verify-full."; exit 1; }
mkdir -p backups
output="backups/render-$(date -u +%Y%m%dT%H%M%SZ).dump"
# No source URL/password in command arguments or shell history.
docker run --rm --env-file secrets/source-db.env postgres:18-bookworm pg_dump --format=custom --no-owner --no-acl > "$output"
test -s "$output"
docker run --rm -i postgres:18-bookworm pg_restore --list < "$output" > "$output.list"
chmod 600 "$output" "$output.list"
sha256sum "$output" > "$output.sha256"
echo "Export complete: $output. This file contains private patient data; keep permissions 600."
