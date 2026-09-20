#!/usr/bin/env bash
# Upgrade an existing 0.8 Docker Compose deployment. Does not run db push.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v flock >/dev/null
exec 9>.fida-upgrade.lock
flock -n 9 || { echo 'Another platform upgrade is running.' >&2; exit 1; }
dc() { docker compose --env-file .env -f infra/docker-compose.yml "$@"; }
sql() { dc exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1' ; }
dc config --quiet
baseline=$(sql <<'SQL'
SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('MerchantApplication','PromotionPolicy');
SQL
)
[[ "$baseline" == 2 ]] || { echo 'Upgrade to 0.8 before running this script.' >&2; exit 1; }
# Rebuild dependencies and generated Prisma client in the container images.
# Set FIDA_NO_CACHE=1 to explicitly discard Docker build cache.
if [[ "${FIDA_NO_CACHE:-0}" == 1 ]]; then dc build --no-cache api admin; else dc build api admin; fi
umask 077
mkdir -p ../fida-backups
backup="../fida-backups/before-0.9-$(date -u +%Y%m%dT%H%M%SZ).dump"
dc exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup"
test -s "$backup"
# Verify the archive can be read before changing the schema.
dc exec -T postgres pg_restore --list < "$backup" >/dev/null
state=$(sql <<'SQL'
SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('MediaAsset','RuntimeSettings','AdminAction','CommissionPeriod','StoreVisit');
SQL
)
case "$state" in
  0) dc exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --single-transaction -f -' < packages/database/prisma/upgrades/20260920-09-schema.sql ;;
  5) echo '0.9 schema already applied.' ;;
  *) echo 'Partial 0.9 schema detected; stopping.' >&2; exit 1 ;;
esac
dc up -d --no-deps api admin
dc exec -T api node -e '(async()=>{for(let i=0;i<15;i++){try{const r=await fetch("http://127.0.0.1:3001/health",{signal:AbortSignal.timeout(1500)});if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,1000));}process.exit(1)})()' || {
  echo 'API may still be starting. Inspect: docker compose --env-file .env -f infra/docker-compose.yml logs --tail=80 api admin' >&2
  exit 1
}
dc ps
echo "Database backup: $backup"
echo 'Verify merchant approval, product saving, checkout preview and a completed test order.'
