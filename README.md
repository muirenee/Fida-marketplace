# Fida Marketplace

Fida Marketplace is a multi-tenant commerce and delivery platform designed for restaurants, supermarkets, pharmacies, shops, and service merchants.

## Applications

- `apps/customer-mobile` — Customer mobile app (Flutter)
- `apps/merchant-mobile` — Merchant operations app (Flutter)
- `apps/driver-mobile` — Courier/driver app (Flutter)
- `apps/admin-web` — Platform administration portal (Next.js)
- `apps/api` — Marketplace API (TypeScript/Fastify foundation)

## Shared packages

- `packages/database` — Prisma schema and database layer
- `packages/shared` — Shared domain types and constants

## Infrastructure

Development infrastructure uses PostgreSQL and Redis through Docker Compose.

## Core principles

1. Multi-tenancy is enforced in the data model from day one.
2. Merchants may have multiple branches.
3. Platform, merchant, branch, driver, and customer roles are distinct.
4. Ordering and delivery are separate state machines.
5. Payment providers are adapter-based so Mobile Money, cards, and cash can coexist.
6. The platform is vertical-agnostic: food is the first use case, not a schema limitation.

## Initial milestone

Customer selects merchant → adds products → checks out → merchant accepts → driver is assigned → pickup → live delivery → completion.
