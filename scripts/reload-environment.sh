#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec 9>.fida-upgrade.lock
flock -n 9 || { echo 'Another platform update is running.' >&2; exit 1; }
dc(){ docker compose --env-file .env -f infra/docker-compose.yml "$@"; }
# Changes must first be saved in Platform administration > Settings.
values=$(dc exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1' <<'SQL'
SELECT "values"::text FROM "RuntimeSettings" WHERE id='platform';
SQL
)
[[ -n "$values" ]] || { echo 'No saved runtime settings.' >&2; exit 1; }
printf '%s' "$values" | python3 scripts/apply-runtime-env.py
dc config --quiet
dc up -d --no-deps --force-recreate api admin
dc ps
