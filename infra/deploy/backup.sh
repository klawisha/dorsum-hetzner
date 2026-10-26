#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
umask 077
exec 8>/tmp/dorsum-backup.lock
flock -n 8 || { echo "A backup is already running."; exit 1; }
# root-owned configuration, not a downloaded file.
source secrets/backup.env
: "${AGE_RECIPIENT:?Set your public age recipient}"
mkdir -p backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
out="backups/dorsum-$stamp.dump.age"
cleanup() { [[ -n "${temporary:-}" ]] && rm -f -- "$temporary"; }
temporary="$out.partial"
trap cleanup EXIT
docker compose exec -T db pg_dump -U dorsum_owner -d dorsum --format=custom --no-owner --no-acl | age -r "$AGE_RECIPIENT" -o "$temporary"
test -s "$temporary"
mv -- "$temporary" "$out"
sha256sum "$out" > "$out.sha256"
# Optional off-site upload. The host key MUST already be verified and stored.
if [[ -n "${STORAGE_BOX_HOST:-}" ]]; then
  : "${STORAGE_BOX_USER:?}"
  : "${STORAGE_BOX_KEY:?}"
  [[ "$STORAGE_BOX_HOST" =~ ^[A-Za-z0-9.-]+$ && "$STORAGE_BOX_USER" =~ ^[A-Za-z0-9_-]+$ ]] || exit 1
  rsync --chmod=F600 -e "ssh -p 23 -i $STORAGE_BOX_KEY -o BatchMode=yes -o StrictHostKeyChecking=yes" "$out" "$out.sha256" "$STORAGE_BOX_USER@$STORAGE_BOX_HOST:dorsum/"
fi
# Retain local encrypted dumps for 14 days. Remote retention is set separately.
find backups -maxdepth 1 -type f -name 'dorsum-*.dump.age*' -mtime +14 -delete
date -u +%FT%TZ > backups/last-success.txt
echo "Encrypted backup completed: $out"
