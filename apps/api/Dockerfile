FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-workspace.yaml prisma.config.ts ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install

# Prisma loads prisma.config.ts during generation and requires DATABASE_URL.
# This build-only URL is not used to connect to a database.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" pnpm db:generate

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["pnpm", "--filter", "@fida/api", "start"]
