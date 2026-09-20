# Fida 0.8 — merchant lifecycle, pricing and layout repair

Branch: `feature/marketplace-business-delivery`. Upgrade the backend before installing the 0.8 apps. This release preserves merchant-owned fleets, merchant-directed online payments and separate post-order commission invoices. It does not claim exact Uber Eats parity.

## Workspace impact map and complete implementations

Paths below are complete source files, not sample snippets. See `IMPACT-0.8.md` for every changed or added file.

| Area | Source |
|---|---|
| Schema and additive migration | `packages/database/prisma/schema.prisma`, `upgrades/20260920-08-enums.sql`, `upgrades/20260920-08-schema.sql` |
| Merchant application validation, nested hours | `apps/api/src/lib/merchant-application.ts`, `business-hours.ts` |
| Onboarding, review, staff provisioning, stock API | `apps/api/src/routes/merchant-lifecycle.ts`, `apps/api/src/lib/tenant.ts` |
| Owner funnel, staff and hours editor | `apps/admin-web/app/merchant/register/page.tsx`, `staff-settings.tsx`, `hours-editor.tsx` |
| Admin review and controls | `apps/admin-web/app/business-operations/application-review.tsx`, `promotion-policy.tsx`, `payment-routing.tsx`, `commission-balances.tsx` |
| Taxes, item discounts, coupons, notes | `apps/api/src/lib/checkout.ts`, `routes/promotions.ts`, `routes/orders.ts`, `routes/merchant.ts` |
| Customer store and checkout | `apps/customer-mobile/lib/screens/merchant_screen.dart`, `checkout_screen.dart`, `core/api_client.dart` |
| Driver historical payments | `apps/driver-mobile/lib/earnings_sheet.dart`, `main.dart`, `apps/api/src/routes/driver-settlements.ts`, `routes/driver.ts` |
| Native merchant stock and tax settings | `apps/merchant-mobile/lib/main.dart`, `catalog_page.dart`, `business_page.dart` |
| Merchant payment routing and invoice ledger | `apps/api/src/routes/payments.ts`, `lib/finance.ts`, `lib/documents.ts`, `routes/documents.ts` |

## Behavior and access rules

1. Create an owner account at `/merchant/register`, then save legal entity/tax ID, branding HTTPS URLs, business type/tags/timezone, structured location and weekly opening windows. Up to four non-overlapping windows per day; overnight windows are supported. Submission creates a hidden `PENDING_APPROVAL` merchant. Existing active stores remain active during migration.
2. Root admin opens **Business operations → Applications**, examines the captured details and approves/rejects with a required reason. Rejected owners can correct and resubmit the same store URL and tenant. Review actions remain in admin audit events. Legal/tax registry verification is a manual administrator task.
3. Merchant API authorization checks current membership, active status and role on every request. Approval, suspension and role changes therefore affect existing access tokens immediately. The portal refreshes status on request; mobile users should sign in again after approval to refresh their local merchant list.
4. **Merchant portal → Staff** lets the owner create MANAGER/KITCHEN_CREW credentials and suspend/reactivate or change roles. Kitchen tokens can read their branch's order queue and catalog, toggle stock, and move orders from accepted to preparing to ready. Financial endpoints are denied; queue database projections exclude monetary fields, and serialization also masks them. Owners/admins retain financial access; managers operate catalog/orders.
5. **Business settings** stores tax label/rate. Checkout computes merchandise subtotal, product discounts, optional cart coupon, line-level tax on discounted merchandise, then delivery. Delivery itself is untaxed in this version. Merchant minimum spend checks gross merchandise; coupon minimum checks merchandise after item discounts. Item offers apply to base product prices, excluding addon prices; the best eligible offer per product is used. Flat item offers are per unit, capped per order. Cart/item stacking respects offer flags and platform policy. Platform rate/amount limits govern newly created offers; disabling stacking takes effect immediately. Tax rules must be configured for the merchant's requirements; this is not a complete jurisdiction-specific tax system.
6. Cooking notes are independent of delivery instructions and persist from cart to order to merchant queue. The server accepts `cookingInstructions`, `cooking_instructions` and `order_notes`. Final confirmation checks the authoritative total again; changed prices require customer review.
7. Customer menu content stays below Android system insets; only the overlapping content panel has top rounded corners. Checkout label/value columns wrap instead of clipping.
8. Driver earnings distinguish recorded actual payments, agreed estimates and absent historical records. Old missing values are not replaced with invented rates. Owners record actual external payments and receipt references under **Driver payments**. Records are immutable through this interface. This records payments; it does not transfer money.
9. Root admin configures a verified Flutterwave `RS_...` merchant destination under **Payment routing**. Online checkout is unavailable until it exists and provider secrets are configured; cash remains available. New payment attempts snapshot the destination and request zero platform commission withholding. New direct-payment completions do not create a platform liability to pay the merchant. Commission invoices/remittances remain separate. Legacy attempts/ledger records retain their previous classification; unstarted legacy online attempts need review instead of silent rerouting. The provider controls settlement timing and fees; this is merchant-directed provider settlement, not an instant bank transfer. See [Flutterwave split payments](https://developer.flutterwave.com/docs/split-payments).
10. **Commission balances** shows merchant-level outstanding balances with invoices and credit notes. Remittances are not yet allocated to individual invoices. Receipts/invoices are commercial documents; RRA EBM fiscal signing is not implemented.

## Safe platform update from 0.7

Run on the deployment server:

```bash
cd /home/irenee/docker/Fida-marketplace
git fetch origin
git switch feature/marketplace-business-delivery
git pull --ff-only origin feature/marketplace-business-delivery
bash scripts/upgrade-0.8.sh
docker compose --env-file .env -f infra/docker-compose.yml logs --tail=80 api admin
```

The complete script builds images (including dependency installation and Prisma generation), verifies a PostgreSQL backup outside the repo, commits enum additions separately, applies the remaining additive migration atomically, then restarts API/admin. It requires the 0.7 schema, detects already-present columns, refuses a partial schema and serializes concurrent local upgrade runs. If still on 0.6, run `bash scripts/upgrade-0.7.sh` first. Do not use `prisma db push` or reapply older SQL on production. Preserve `.env`, the PostgreSQL volume and media volume. Firebase service-account JSON stays a single correctly quoted `.env` value; it is not an Android `google-services.json`.

Explicit clean container rebuild, only if needed:

```bash
cd /home/irenee/docker/Fida-marketplace
FIDA_NO_CACHE=1 bash scripts/upgrade-0.8.sh
```

Inspect failures before retrying. If migration fails, its schema transaction rolls back; already-committed enum labels are safe to leave in place and rerun. The old containers are not stopped before the migration. If application health fails after recreation, inspect logs; do not restore a backup over new orders. Database rollback requires a maintenance window, preservation of post-backup orders, and explicit operator review.

## Local production APK/AAB builds

Prerequisites: Linux/macOS, Flutter stable with Android support, Java 17, Android SDK and accepted licenses, Python 3, the existing release keystore/alias/passwords, and each app's matching `google-services.json` from your one Firebase project. Install Flutter/Android tooling per the official platform documentation before running the script. The three package IDs remain `com.fidalix.marketplace.customer_mobile`, `.merchant_mobile` and `.driver_mobile`.

```bash
cd /home/irenee/docker/Fida-marketplace
flutter doctor -v
flutter doctor --android-licenses
bash scripts/build-android.sh all apk
bash scripts/build-android.sh all appbundle
```

For just one app:

```bash
bash scripts/build-android.sh customer apk
bash scripts/build-android.sh merchant apk
bash scripts/build-android.sh driver apk
```

The script prompts for the existing signing key and passwords. It reads each existing `apps/ROLE-mobile/android/app/google-services.json` or prompts for its file path, validates the matching package through `configure_mobile.py`, creates/configures Android projects, clears Flutter build caches, resolves packages, analyzes, tests and builds. It outputs `dist/android/fida-ROLE-BUILDNUMBER.apk` or `.aab`. It never creates a replacement release key. Java properties escape special characters in passwords. Key properties and keystores are ignored by git. Protect the local machine and do not publish these files.

Default API URL: `https://marketplaceadmin.fidalix.com`. Override with `FIDA_API_BASE_URL` when testing another server. Build numbers use seconds since 2020, shared by the CI/local convention; build with a correct clock and a larger number than the installed version. `FIDA_BUILD_NUMBER` supports an explicit integer override. APKs update existing installs only with the same package ID and signing certificate.

GitHub push triggers Validate, Customer Mobile, Merchant Mobile and Driver Mobile. Existing per-app Firebase and permanent signing secrets are used. Missing signing secrets cause the existing CI workflow to produce a debug APK, which is not a production replacement; check the artifact name before installation.

## Verification and prioritized missing features

`npm run test:integration` exercises origin protection, real SQL-backed API integration and the 0.7→0.8 migration. `npm run typecheck:api` validates backend types; the Admin Next production build validates web routes and components. Customer widget tests cover menu insets, enlarged-text checkout, cart configurations and required modifiers. Driver widget tests separate actual/estimated/missing history. `python3 scripts/audit-roadmap.py` compares named implementation evidence and produces `ROADMAP-AUDIT-0.8.json`; source presence alone does not prove production completeness.

| Priority | Remaining work / acceptance | Evidence or limitation |
|---|---|---|
| P0 before online payment rollout | Verify each merchant provider subaccount, live fees/settlement destination, successful/cancelled payment and refund reconciliation | Provider adapter is tested with mocked responses; no live money certification performed |
| P0 before mobile rollout | Real-device push, locked-screen GPS, background permission, call/map intents, PIN completion and visual screenshots | Emulator/widget tests cannot prove Android vendor battery behavior or deployed Firebase delivery |
| P1 | Automated provider refund execution, transfer reconciliation and invoice-specific remittance allocation | Existing refund approvals/receipt logging and merchant-level ledger do not automate transfers |
| P1 | Jurisdiction-specific tax treatment, fiscal EBM integration | Configurable merchandise VAT and commercial receipts are implemented; fiscal certification is separate |
| P1 | Production load/concurrency, queue recovery and shared rate-limit verification | In-memory PostgreSQL tests exercise transactions, not production stress/failover |
| P2 | Native multi-step onboarding, staff/promotion/settlement management | Merchant app securely opens the complete web portal for these modules; native tax/stock controls exist |
| P2 | Branding file upload inside onboarding | Functional HTTPS logo/cover URL fields exist; product image upload is supported elsewhere |
| P2 | Traffic-aware embedded directions, dynamic ETA and multi-stop route optimization | Existing delivery map and external Google Maps navigation remain supported |
| P2 | Staff password reset/admin recovery UI and per-invoice payment allocation | Credential creation, suspension and role edits exist; specialized recovery/allocation flows do not |
| P3 | SMS/social authentication, subscriptions, conversion analytics and full Uber Eats parity | Not implemented or claimed by this release |
