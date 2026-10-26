#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
exec 9>/tmp/dorsum-deploy.lock
flock -n 9 || { echo "Another deployment is running."; exit 1; }
test -s secrets/app.env && test -s secrets/migrate.env
# Validate without dumping the resolved configuration or secrets.
docker compose config --quiet
docker compose build api
docker compose up -d db
for attempt in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U dorsum_owner -d dorsum >/dev/null 2>&1; then break; fi
  sleep 1
done
# For updates, preserve a consistent pre-migration backup when configured.
if [[ -s secrets/backup.env ]]; then bash backup.sh; fi
# Stop old application writes before database upgrades; fail closed on errors.
docker compose stop api
docker compose run --rm --no-deps migrate
docker compose exec -T db psql -X -U dorsum_owner -d dorsum -f /ops/db-grants.sql >/dev/null
docker compose up -d --no-deps --force-recreate api
healthy=0
for attempt in $(seq 1 30); do
  if docker compose exec -T api node -e "fetch('http://127.0.0.1:5000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then healthy=1; break; fi
  sleep 2
done
[[ "$healthy" = 1 ]] || { echo "API health check failed; inspect docker compose logs --tail=80 api."; exit 1; }
docker compose up -d caddy
echo "Deployment ready. Verify HTTPS and /api/health/ready through Vercel."
