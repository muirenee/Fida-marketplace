FROM node:24-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY apps/admin-web/package.json ./apps/admin-web/package.json

RUN pnpm install --filter @fida/admin-web... --no-frozen-lockfile

COPY apps/admin-web ./apps/admin-web

ENV NODE_ENV=production
ENV PORT=3000

RUN pnpm --filter @fida/admin-web build

EXPOSE 3000

CMD ["pnpm", "--filter", "@fida/admin-web", "start"]
