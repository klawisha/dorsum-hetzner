#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
umask 077
test -s secrets/source-db.env
mkdir -p backups
docker run --rm -i --env-file secrets/source-db.env postgres:18-bookworm psql -X -At -v ON_ERROR_STOP=1 < import-check.sql > backups/source-check.json
docker compose exec -T db psql -X -U dorsum_owner -d dorsum -At -v ON_ERROR_STOP=1 < import-check.sql > backups/target-check.json
python3 - <<'PY'
import json,pathlib
source=json.loads(pathlib.Path('backups/source-check.json').read_text())
target=json.loads(pathlib.Path('backups/target-check.json').read_text())
diff={key:[source[key],target.get(key)] for key in source if source[key]!=target.get(key)}
if diff:
    print('Import mismatch:',diff)
    raise SystemExit(1)
print('PASS: row counts, cash totals and image/receipt digests match the source database.')
PY
