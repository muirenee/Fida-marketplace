# 0.12 Enatega adaptation checkpoint
Base: 399dd30698b424cb87a218bcc24585e344688317.
Reference: enatega/food-delivery-multivendor at 389481597ff253c5178e38c316bf646746e91695.
Keep Flutter/Fastify/PostgreSQL, merchant-owned fleets, direct merchant payments, post-order commission invoices.
- [x] Reference audit and license review.
- [x] Reorder API with modifier snapshots and current availability/prices.
- [x] Tenant/branch-scoped queue aggregation and server filtering.
- [x] Customer reorder review and active/history UI.
- [x] Merchant app/portal queue counts and driver route cards.
- [x] API/admin typechecks; 43 isolated origin/business/migration tests; shell syntax.
- [x] Adaptation evidence, compatibility and deployment documentation.
- [x] GitHub Flutter analysis/widget tests and signed APK builds.
Commit 86c1bcb: Validate 36338928035, Customer 36338928079, Merchant 36338928061, Driver 36338928069 all succeeded. Superseded by the user-requested 0.13 pricing upgrade before APK delivery.
No Enatega proprietary API, endpoint defaults, credentials, telemetry or assets imported.
