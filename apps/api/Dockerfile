# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

# Keep dependency installation in a stable layer. API source changes should not
# invalidate pnpm install, and unrelated admin/mobile apps are not copied here.
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/database/package.json ./packages/database/package.json

RUN --mount=type=cache,id=fida-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --no-frozen-lockfile

COPY prisma.config.ts ./
COPY scripts/generate-admin-catalog.mjs ./scripts/generate-admin-catalog.mjs
COPY apps/api ./apps/api
COPY packages/database ./packages/database

# Prisma loads prisma.config.ts during generation and requires DATABASE_URL.
# This build-only URL is not used to connect to a database.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm db:generate

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["pnpm", "--filter", "@fida/api", "start"]
