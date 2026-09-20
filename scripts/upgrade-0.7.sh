#!/usr/bin/env bash
# Run from a checkout of feature/marketplace-business-delivery already on 0.6.
set -euo pipefail
cd "$(dirname "$0")/.."
dc() { docker compose --env-file .env -f infra/docker-compose.yml "$@"; }
dc config --quiet
dc build api admin
mkdir -p ../fida-backups
backup="../fida-backups/before-0.7-$(date -u +%Y%m%dT%H%M%SZ).dump"
dc exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup"
test -s "$backup"
state=$(dc exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1' <<'SQL'
SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND
 ((table_name='DeliveryOperator' AND column_name IN ('driverBasePay','driverPerKmPay')) OR
 (table_name='Delivery' AND column_name IN ('estimatedPayout','payoutCurrency')) OR
 (table_name='BusinessDocument' AND column_name='payload'));
SQL
)
case "$state" in
  0) dc exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --single-transaction -f -' < packages/database/prisma/upgrades/20260919-experience-documents.sql ;;
  5) echo '0.7 database upgrade already applied.' ;;
  *) echo 'Partial 0.7 schema detected. Stopping without changing the database.' >&2; exit 1 ;;
esac
dc up -d --no-deps api admin
dc ps
echo "Database backup: $backup"
echo 'Check the public merchant list, save a product, and complete a test order before rollout.'
