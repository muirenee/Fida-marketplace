# 0.13 checkpoint
Base: 86c1bcbc1ec9df5b27db841462cb10025287de48.
Upstream main checked 2026-09-27: 389481597ff253c5178e38c316bf646746e91695 (unchanged from 0.12).

- [x] Buy 1–50 paid units, automatically add one configured free unit; product badges.
- [x] Independent premium choice counters (1–20 per parent unit), validated snapshots and separate breakdown lines.
- [x] New-order tax inclusive of merchandise, extras and delivery; historical amounts retained.
- [x] Receipt, refund, commission and legacy ledger calculations aligned.
- [x] Quote fingerprint rejects changed rewards even if cash total is identical.
- [x] Additive migration and root build/deploy script entry points.
- [x] API/admin typechecks, 46 isolated integration/migration tests and shell syntax.
- [x] Flutter analysis/widget verification and signed 0.13 builds.
- [x] Verification outcome and artifact metadata: docs/APK-VERIFICATION-0.13.json.

Actual workspace: apps/customer-mobile, apps/merchant-mobile, apps/driver-mobile (Flutter), apps/admin-web (Next), apps/api (Fastify). The named Enatega Expo folders and eas.json are absent. Do not invent an EAS project/profile or replace signed Flutter package identities.

Remaining acceptance: real-device push/background GPS, live provider payments/refunds, staging backup restoration. Remaining reference gaps: customer web storefront, localization/social auth, in-app chat, traffic ETA/multi-stop optimization, queue pagination and socket reconciliation, EBM integration. No claims of full native Enatega parity or completed external acceptance.

All tests use isolated temporary databases. No production reset, payout, provider configuration or migration was executed. Credit resets cannot wake a stopped session; resume this checkpoint on the next active turn.

Final source 4dce7c3416871c83dbb8311dd337e196bcd5273f. All workflows succeeded: Validate 36351460790, Customer 36351460765, Merchant 36351460741, Driver 36351460749. Downloaded release ZIP digests match GitHub. APK package IDs, 0.13.0 version names, increasing version codes and certificates match the existing installation identities. Server deployment and physical-device acceptance remain operator tasks.
