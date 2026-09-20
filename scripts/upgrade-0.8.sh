#!/usr/bin/env bash
# Upgrade an existing 0.7 Docker Compose deployment. Does not run db push.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v flock >/dev/null
exec 9>.fida-upgrade.lock
flock -n 9 || { echo 'Another platform upgrade is running.' >&2; exit 1; }
dc() { docker compose --env-file .env -f infra/docker-compose.yml "$@"; }
sql() { dc exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1' ; }
dc config --quiet
baseline=$(sql <<'SQL'
SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND
 ((table_name='DeliveryOperator' AND column_name IN ('driverBasePay','driverPerKmPay')) OR
 (table_name='Delivery' AND column_name IN ('estimatedPayout','payoutCurrency')) OR
 (table_name='BusinessDocument' AND column_name='payload'));
SQL
)
[[ "$baseline" == 5 ]] || { echo 'This script requires the complete 0.7 database schema.' >&2; exit 1; }
# Rebuild dependencies and generated Prisma client in the container images.
# Set FIDA_NO_CACHE=1 to explicitly discard Docker build cache.
if [[ "${FIDA_NO_CACHE:-0}" == 1 ]]; then dc build --no-cache api admin; else dc build api admin; fi
umask 077
mkdir -p ../fida-backups
backup="../fida-backups/before-0.8-$(date -u +%Y%m%dT%H%M%SZ).dump"
dc exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup"
test -s "$backup"
# Verify the archive can be read before changing the schema.
dc exec -T postgres pg_restore --list < "$backup" >/dev/null
state=$(sql <<'SQL'
SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND
 ((table_name='Tenant' AND column_name IN ('coverUrl','cuisineTags','legalName','logoUrl','paymentSubaccount','taxId','taxLabel')) OR
 (table_name='TenantMembership' AND column_name='isActive') OR
 (table_name='Order' AND column_name IN ('cookingInstructions','taxLabel')) OR
 (table_name='OrderItem' AND column_name IN ('discount','tax')) OR
 (table_name='Delivery' AND column_name IN ('settledAt','settledPayout','settlementReference')) OR
 (table_name='Promotion' AND column_name IN ('discountType','flatAmount','productId','stackable','updatedAt')) OR
 (table_name='PaymentAttempt' AND column_name IN ('destinationSubaccount','settlementMode')) OR
 (table_name IN ('MerchantApplication','PromotionPolicy') AND column_name='id'));
SQL
)
case "$state" in
  0)
    # PostgreSQL enum labels must be committed before the new default uses them.
    dc exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --single-transaction -f -' < packages/database/prisma/upgrades/20260920-08-enums.sql
    dc exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --single-transaction -f -' < packages/database/prisma/upgrades/20260920-08-schema.sql
    ;;
  24) echo '0.8 database columns are already present.' ;;
  *) echo 'Partial 0.8 schema detected. No migration applied; inspect before continuing.' >&2; exit 1 ;;
esac
dc up -d --no-deps api admin
dc exec -T api node -e '(async()=>{for(let i=0;i<15;i++){try{const r=await fetch("http://127.0.0.1:3001/health",{signal:AbortSignal.timeout(1500)});if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,1000));}process.exit(1)})()' || {
  echo 'API may still be starting. Inspect: docker compose --env-file .env -f infra/docker-compose.yml logs --tail=80 api admin' >&2
  exit 1
}
dc ps
echo "Database backup: $backup"
echo 'Verify merchant approval, product saving, checkout preview and a completed test order.'
