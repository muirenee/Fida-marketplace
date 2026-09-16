# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim

WORKDIR /app

RUN corepack enable

# Keep dependency installation independent from application source changes.
COPY package.json pnpm-workspace.yaml ./
COPY apps/admin-web/package.json ./apps/admin-web/package.json

# Reuse the pnpm store across Docker builds.
RUN --mount=type=cache,id=fida-admin-pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --filter @fida/admin-web... --no-frozen-lockfile

COPY apps/admin-web ./apps/admin-web

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Reuse Next.js' compiler cache across builds while keeping the final .next output in the image.
RUN --mount=type=cache,id=fida-admin-next-cache,target=/app/apps/admin-web/.next/cache \
    pnpm --filter @fida/admin-web build

EXPOSE 3000

CMD ["pnpm", "--filter", "@fida/admin-web", "start"]
