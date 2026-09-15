# Fida Marketplace deployment

This deployment runs PostgreSQL, Redis, and the Fastify API with Docker Compose. Only the API is published on the host; PostgreSQL and Redis remain on the private Docker network.

## Requirements

- Docker Engine with the Compose plugin
- A Linux host
- An HTTPS reverse proxy that can reach the published API address

## Environment

Copy `.env.example` to `.env` and replace every placeholder secret.

For the current NetBird-backed test deployment, the important values are conceptually:

```env
POSTGRES_DB=fida_marketplace
POSTGRES_USER=fida_app
POSTGRES_PASSWORD=<strong-random-password>
DATABASE_URL=postgresql://fida_app:<same-password>@postgres:5432/fida_marketplace?schema=public
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=<at-least-32-random-characters>
JWT_ACCESS_TTL=15m
REFRESH_TOKEN_DAYS=30
CORS_ORIGIN=https://marketplaceadmin.fidalix.com
APP_ENV=production
PORT=3001
API_BIND_ADDRESS=<host-address-reachable-by-reverse-proxy>
```

Do not commit `.env`.

## Start

```bash
docker compose --env-file .env -f infra/docker-compose.yml up -d --build
```

Check services:

```bash
docker compose --env-file .env -f infra/docker-compose.yml ps
```

## Initialize or update the test database

The current test deployment uses Prisma `db push`:

```bash
docker compose --env-file .env -f infra/docker-compose.yml exec api pnpm db:push
```

Production releases should move to committed Prisma migrations before real customer data is stored.

## Seed the first platform administrator

Pass seed credentials only for the one command instead of storing them in Compose:

```bash
docker compose --env-file .env -f infra/docker-compose.yml exec \
  -e SEED_ADMIN_EMAIL='<admin-email>' \
  -e SEED_ADMIN_PASSWORD='<strong-password>' \
  api pnpm db:seed
```

## Health check

Local/reverse-proxy target:

```bash
curl http://<API_BIND_ADDRESS>:3001/health
```

Public HTTPS endpoint for the current test environment:

```bash
curl https://marketplaceadmin.fidalix.com/health
```

Expected response:

```json
{"service":"fida-marketplace-api","status":"ok","version":"0.4.0"}
```

## Safety notes

- Do not publish PostgreSQL port 5432 or Redis port 6379 on the host.
- Keep `.env` outside Git.
- Back up the PostgreSQL volume before destructive Compose operations.
- `docker compose down -v` deletes persistent database and Redis volumes; do not use it on a system containing real data.
