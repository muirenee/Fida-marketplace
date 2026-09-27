# Enatega workflow adaptation — Fida 0.12

Reference: https://github.com/enatega/food-delivery-multivendor/tree/389481597ff253c5178e38c316bf646746e91695
Audited: 2026-09-27. Fida baseline: 399dd30698b424cb87a218bcc24585e344688317.

The reference repository uses React Native/Expo, Next.js and Apollo/GraphQL. Its root LICENSE is MIT (Copyright 2023 Ninjas Code); its README states that the backend/API is proprietary and requires a paid license. This change independently implements useful workflows in Fida's Flutter/Fastify/PostgreSQL architecture. No reference source code, branding, artwork, credentials, demo endpoints or proprietary backend was imported.

## Implemented adaptation

| Reference source | Fida implementation | Behavior |
|---|---|---|
| `enatega-multivendor-app/src/screens/Reorder/Reorder.js` | `apps/api/src/routes/reorder.ts`, `apps/customer-mobile/lib/screens/reorder_screen.dart` | Read-only reorder draft uses current products/prices; unavailable items disabled; changed/legacy options require configuration; customer explicitly reviews cart and confirms checkout. |
| Customer order-history/reorder flow | `apps/customer-mobile/lib/screens/orders_screen.dart`, `apps/api/src/routes/orders.ts` | Active/history filtered before result limits, receipt/tracking actions, order-again action, stale request protection. |
| `enatega-multivendor-store/app/(protected)/(tabs)/home/orders/_layout.tsx` and `lib/ui/screen-components/home/orders/main/new-orders.tsx` | `apps/api/src/lib/merchant-order-query.ts`, `apps/api/src/routes/merchant.ts`, `apps/merchant-mobile/lib/main.dart`, `apps/admin-web/app/merchant/page.tsx` | New/processing/ready/history queues; counts include all matching records, scoped to merchant/branch and search; active work sorted oldest first. Existing push/poll updates retained. |
| `enatega-multivendor-rider/lib/ui/useable-components/order/order-card-presentation.tsx` | `apps/driver-mobile/lib/delivery_route_summary.dart`, `apps/driver-mobile/lib/main.dart` | Numbered pickup/drop-off stops, wrapping addresses, explicit payment status and order value separate from estimated driver payout; existing navigation/call/PIN controls retained. |

## Schema and compatibility

`OrderItem.selectedOptions` is nullable JSONB. New checkouts persist the exact validated modifier names. Existing null snapshots are unknown choices, not an empty selection. Older orders with configurable products require the customer to choose again; historical display names are never parsed as identifiers. Modifier identity remains the existing unique name; renamed options require reconfiguration.

`packages/database/prisma/upgrades/20260927-012-schema.sql` adds the column without rewriting historical prices, documents or ledger entries. `scripts/update-platform.sh` backs up first and applies it transactionally and repeatably. Deploy backend before installing 0.12 apps.

Reordering does not copy old promo codes, addresses, payment authorizations or cooking instructions. The existing checkout engine validates eligibility, required options, BOGO/product/cart promotions, tax, delivery and confirmed total again. Reordering creates no order until the customer confirms checkout.

Queue summaries contain counts only. Kitchen access permits that one additional read route; financial endpoints and masked order fields remain restricted. List limits remain 200 merchant orders / 100 customer orders per selected scope; counts may exceed visible rows. Search is available in the merchant app. Cursor pagination is still open work.

## Existing features retained

- Merchant approval, staff/branch RBAC and inventory controls.
- Merchant-owned fleets, direct customer-to-merchant online payments and cash.
- Post-completion commission documents/ledger; no new platform split or payout transfer.
- BOGO and scoped discounts, notes, scheduled orders, receipts, address pinning and live tracking.
- Runtime endpoint configuration, ranked featured stores, protected purge/reset controls.

## Remaining gaps / acceptance checklist

These are explicit remaining items, not a claim of Enatega/Uber Eats parity.

1. **P0 production acceptance:** physical Android background-GPS/battery behavior; push delivery on all three registered Firebase apps; real payment provider settlement/refund callbacks; restore a database backup in a staging environment. CI cannot establish those live-service outcomes.
2. **P1 operational scale:** cursor pagination for order/history queues; live socket subscriptions and reconnect reconciliation (current merchant UI polls every eight seconds plus existing push); route optimization and traffic-aware ETAs; searchable audit/report exports.
3. **P1 customer reach:** full customer web storefront, localization/accessibility audit across every screen, social sign-in, customer/driver in-app chat. These were not added in 0.12.
4. **P1 finance:** EBM/fiscal integration and automated external transfer reconciliation remain separate integrations; current commercial receipts and actual payment logs are not fiscal certification or automated transfers.
5. **P2 product:** subscriptions/loyalty, deeper conversion analytics and multi-stop dispatch optimization.

## Deployment

```bash
cd /home/irenee/docker/Fida-marketplace
git switch feature/marketplace-business-delivery
git pull --ff-only origin feature/marketplace-business-delivery
bash scripts/update-platform.sh
```

Build all three APKs locally with the existing configured Flutter/Android SDK, Firebase files and original signing key:

```bash
bash scripts/build-apks.sh
```

Source version is `0.12.0+13`; GitHub CI assigns increasing Android version codes and uses existing per-app Firebase/signing secrets. APK outputs are under `dist/android/` locally and release artifacts in GitHub Actions. Do not replace the signing key for installed-app updates.

## Verification

`npm run typecheck:api`, admin TypeScript checks, `npm run test:integration` (isolated PGlite), and CI Flutter analysis/widget tests. New regressions cover snapshot persistence, repricing, legacy/changed/unavailable options, store/customer isolation, branch-scoped counts, migration preservation, active/history races, explicit reorder review and large-text driver cards. See `WORK-STATE-0.12.md` for final CI state.
