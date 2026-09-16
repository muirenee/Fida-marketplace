# Fida Marketplace deployment

This deployment runs PostgreSQL, Redis, the Fastify API, and the Next.js Admin web with Docker Compose. PostgreSQL and Redis remain on the private Docker network. The API and Admin web are published only on the host addresses selected for the reverse proxy.

## Requirements

- Docker Engine with the Compose plugin
- A Linux host
- An HTTPS reverse proxy that can reach the published API and Admin addresses

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
ADMIN_BIND_ADDRESS=<host-address-reachable-by-reverse-proxy>
```

Do not commit `.env`.

## Start or update

```bash
git pull
docker compose --env-file .env -f infra/docker-compose.yml up -d --build
```

Check services:

```bash
docker compose --env-file .env -f infra/docker-compose.yml ps
```

Expected services are `postgres`, `redis`, `api`, and `admin`.

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

## Reverse proxy layout

The same public hostname can serve both the Admin web and the mobile/API clients. Route the API paths to port 3001 and everything else to the Admin web on port 3000:

```text
https://marketplaceadmin.fidalix.com/v1/*    -> http://<host>:3001/v1/*
https://marketplaceadmin.fidalix.com/health  -> http://<host>:3001/health
https://marketplaceadmin.fidalix.com/*       -> http://<host>:3000/*
```

Keep the more specific `/v1` and `/health` routes ahead of the catch-all `/` route. The three mobile apps continue using `https://marketplaceadmin.fidalix.com` as their API base URL, while a browser opening the hostname receives the Admin web.

The Admin web does not store platform refresh tokens in JavaScript-accessible storage. Its Next.js server routes use HTTP-only cookies and call the API over the private Docker network at `http://api:3001`.

## Health checks

API target:

```bash
curl http://<API_BIND_ADDRESS>:3001/health
```

Admin target:

```bash
curl -I http://<ADMIN_BIND_ADDRESS>:3000/
```

Public API health endpoint:

```bash
curl https://marketplaceadmin.fidalix.com/health
```

Expected API response:

```json
{"service":"fida-marketplace-api","status":"ok","version":"0.4.0"}
```

## Safety notes

- Do not publish PostgreSQL port 5432 or Redis port 6379 on the host.
- Keep `.env` outside Git.
- Back up the PostgreSQL volume before destructive Compose operations.
- `docker compose down -v` deletes persistent database and Redis volumes; do not use it on a system containing real data.
- Keep API `/v1` routing intact when switching the domain root to the Admin web, otherwise the installed mobile builds will stop reaching the backend.
