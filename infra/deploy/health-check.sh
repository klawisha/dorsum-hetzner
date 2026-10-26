#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
domain=$(sed -n 's/^API_DOMAIN=//p' .env)
[[ "$domain" =~ ^[A-Za-z0-9.-]+$ ]]
curl --fail --silent --show-error --max-time 15 "https://$domain/health/ready"
docker compose exec -T db psql -X -U dorsum_owner -d dorsum -Atc "SELECT rolname,rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname='dorsum_app'"
df -h /
if [[ -s backups/last-success.txt ]]; then
  stamp=$(date -d "$(cat backups/last-success.txt)" +%s)
  [[ $(( $(date +%s) - stamp )) -lt 172800 ]] || { echo "Last backup is older than 48 hours."; exit 1; }
fi
