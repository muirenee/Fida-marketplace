# Fida 0.6 implementation and release handoff

Updated 19 September 2026. Source branch: `feature/marketplace-business-delivery`.
This is an implementation candidate. Deployment has begun; device acceptance is still in progress.

## Merchant listing and portal save fix

The marketplace query incorrectly filtered delivery zones by `deletedAt`, which does not exist on that model. This caused both merchant listing and catalog requests to return HTTP 500. The filter now uses `isActive`, and the shared selection is checked against the Prisma type. Regression tests cover public listing, product search and catalog retrieval with inactive delivery zones excluded.

Merchant browser writes compared the external HTTPS origin with the internal Docker request URL. Login, logout and merchant writes now share an exact origin check using `PUBLIC_BASE_URL`, which Compose passes to the admin service. Cross-origin requests remain rejected. Set `PUBLIC_BASE_URL=https://marketplaceadmin.fidalix.com` for the current deployment; direct local deployments should use their actual public URL.

For servers already upgraded to 0.6, pull `feature/marketplace-business-delivery` and rebuild/recreate both `api` and `admin`. These fixes require neither a new database migration nor new APKs. Verify `/v1/marketplace/merchants` returns HTTP 200, then refresh Customer and retry a merchant product save.

## Implemented in this branch

- Merchant web portal at `/merchant`: existing merchant sign-in, business selection, order queue, product and category controls, driver creation/enrollment/editing/suspension, branch hours and temporary closures, promotions, support cases and finance entries. Writes enforce merchant membership and role on the API.
- Merchant mobile catalog: create/edit/suspend/delete products and categories, upload/change photos, optional priced choices/add-ons. Deletion preserves historical order lines.
- Driver controls: merchant-owned driver accounts, vehicle details, branch assignment and capacity. Active deliveries prevent suspension or reassignment. Driver responses exclude password hashes and customer delivery PINs.
- Delivery: customer address/coordinates open maps; Navigate launches Google Maps directions with navigation intent; telephone links open the dialer. Route ordering uses nearest geographic stop with pickup precedence; Google Maps provides actual turn-by-turn guidance outside Fida. Completion requires the customer's four-digit PIN for new delivery orders.
- Customer ordering: search and favorites, photos, optional add-ons, scheduled orders, promo codes, server-calculated tax/totals, retry-safe checkout keys, reviews, support and refund requests.
- Colorful shared green/cream theme with orange and purple accents; responsive merchant dashboard. Inspired by familiar food-delivery workflows with Fida branding.
- Push infrastructure: Firebase device registration, permission flow, token refresh/removal on logout, foreground banners, order refresh on incoming messages and transactional notification outbox with retries. It remains inactive without Firebase configuration.
- Payments: Flutterwave hosted card/Mobile Money checkout; signed webhook gate plus server-to-server amount/currency/reference/status verification; idempotent payment ledger. Payment tests mock the provider; no live or sandbox payment certification has occurred.
- Operations: Fida fleet enrollment/dispatch, finance ledger, refund approval and external receipt recording, merchant payout receipt recording and 30-day order/delivery/repeat-customer reporting. Refund/payout recording does not execute bank or provider transfers.

## Validation actually completed

- API TypeScript check passed.
- Eight database-backed integration test groups passed using temporary PGlite PostgreSQL-compatible storage, including public marketplace listing/catalog/search, tenant/role isolation, driver account privacy, checkout availability restrictions, options/promotion/tax calculation and retry behavior, delivery capacity/PIN/transitions, refund authorization, and payment tampering/replay protection. Four origin-check regression tests passed for the portal.
- PGlite uses one database connection. These tests do not prove concurrent behavior on production PostgreSQL; exercise contention in staging before release.
- Flutter analysis and signed Android builds passed in GitHub Actions for all three apps, including their Firebase configuration. Device permissions and notification/navigation behavior still require physical-device testing.
- Merchant/admin Next.js production build passed, including the merchant and business-operations routes. Browser visual QA was attempted but the environment has no installed Chromium; visual and device QA remain pending.

## Release steps

1. The user authorized publication to `muirenee/Fida-marketplace`; the feature branch and signed APKs have been published. Continue deploying from `feature/marketplace-business-delivery` until it is merged.
2. Keep Validate passing for new changes. Mobile workflows produce debug APKs for PRs and signed release builds for configured branch pushes or manual runs with the existing signing secrets. Server-only fixes do not require APK rebuilds.
3. Back up the production database and uploaded media. Apply `packages/database/prisma/upgrades/20260919-business-delivery.sql` to a staging copy of the current main schema first. This is a one-time additive upgrade script, not a Prisma migrate history directory. Do not reset a production database. Existing cash orders remain valid; existing delivery orders without a PIN retain the original completion behavior.
4. Deploy API and web together with the updated schema and persistent `fida_media` volume. Keep `/v1/*` routed to the API, including uploaded media. The existing public host should route `/merchant` and `/business-operations` to the Next.js service.
5. Configure the following secrets through repository/deployment settings; do not commit credentials or paste a private key into chat.
6. Install the signed APKs on physical Android devices and run the acceptance checklist. Then make them available to merchants, drivers and customers.

## Configuration you supply

### Firebase

Create/register three Android apps in one Firebase project with these exact package IDs:

| App | Package | Repository Actions secret |
| --- | --- | --- |
| Customer | `com.fidalix.marketplace.customer_mobile` | `FIDA_CUSTOMER_GOOGLE_SERVICES_JSON` |
| Merchant | `com.fidalix.marketplace.merchant_mobile` | `FIDA_MERCHANT_GOOGLE_SERVICES_JSON` |
| Driver | `com.fidalix.marketplace.driver_mobile` | `FIDA_DRIVER_GOOGLE_SERVICES_JSON` |

Each secret contains the matching downloaded `google-services.json`. Set the API deployment secret `FIREBASE_SERVICE_ACCOUNT_JSON` to a Firebase Admin service-account JSON from the same project. Rebuild the APKs after setting the mobile configs, deploy/restart the API, sign in on each device and allow notifications. Android 13+ requires notification permission. Confirm delivery in foreground, background and after tapping a notification. Force-stopped apps may not receive messages until reopened.

### Payments

Set `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_SECRET` and the HTTPS `PUBLIC_BASE_URL`. Configure the provider webhook URL as `https://marketplaceadmin.fidalix.com/v1/payments/webhook`, with the matching v3 verification hash. Test card and Rwanda Mobile Money support with the merchant's approved provider account, currency and enabled payment methods. Both secrets are required before online payment choices become visible. Cash remains available. Do not enable live payments until success, failed/abandoned checkout, duplicate webhook and refund reconciliation have been verified with the provider.

### Signing and financial policy

Reuse existing `FIDA_ANDROID_KEYSTORE_BASE64`, `FIDA_ANDROID_KEYSTORE_PASSWORD`, `FIDA_ANDROID_KEY_ALIAS`, `FIDA_ANDROID_KEY_PASSWORD` Actions secrets so new releases update installed apps. Set tax rates only after the operator establishes the applicable business policy. Fida driver earnings need an agreed fee/share policy and payout process; this branch does not invent one.

## Acceptance checklist

- Owner creates a driver, driver signs in, owner edits vehicle/capacity; a different merchant cannot see or modify that driver. Staff cannot manage accounts. Suspension is blocked during active delivery and prevents subsequent driver access when allowed.
- Upload JPEG/PNG/WebP under 5 MB, edit category/product, suspend and delete it. Customer browse and checkout reject hidden items while historical orders remain readable.
- Place cash pickup/delivery orders. Confirm totals, optional add-ons, promo expiry/use cap, opening-hours timezone and scheduled preparation window.
- Merchant accepts/prepares/marks ready; driver claims within capacity, opens pickup/customer navigation, taps customer phone, tracks while navigating, and completes with the customer PIN. Wrong PIN fails.
- Verify push across all three roles and order refresh. Check expired login refresh and logout token removal. No PIN appears in merchant/driver notifications or API responses.
- Run real PostgreSQL concurrent claim, cancellation/preparation, capacity-change and promo-limit tests. Review API logs and rate limits behind the deployed proxy.
- Test online payment and delayed webhook behavior using provider test credentials; reconcile a manually executed refund and payout against external receipts.

## Roadmap items still open

Required/exclusive variant groups; road/traffic-based multi-stop optimization or embedded navigation; automated refunds and bank settlement; Fida driver earnings and payouts; full visitor-to-order conversion instrumentation; stronger distributed abuse/fraud controls; staging concurrency tests; production provider certification; mobile device QA. These remain open rather than being represented as finished by a scaffold or an external configuration placeholder.

## Local checks

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm typecheck:api
pnpm test:integration
pnpm --filter @fida/admin-web build
```

The mobile CI workflows generate Android scaffolds, configure branding/Firebase, run Flutter analysis, and build APKs. Local Flutter execution was blocked by automatic approval review when it attempted instance metadata access; no workaround was used to repeat that blocked access.

Official setup references: [Firebase Flutter setup](https://firebase.google.com/docs/cloud-messaging/flutter/get-started), [message handling](https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages), [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started), [Flutterwave verification](https://developer.flutterwave.com/docs/transaction-verification), [Flutterwave webhooks](https://developer.flutterwave.com/docs/webhooks).
