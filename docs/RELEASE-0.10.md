# Fida Marketplace 0.10

- [x] Public runtime configuration, secure mobile cache and shared URL observer across all three apps. Owned media is normalized to relative paths transactionally; external image/payment URLs remain external.
- [x] API CORS and browser mutation guards follow runtime origins. Merchant business links resolve the current public URL. Legacy media input/output is normalized so older clients cannot restore obsolete owned URLs.
- [x] Automatic featured stores: completed non-refunded orders over 30 days, units sold, rating, then stable ID. Active/open branches and available products are required. Admins can search and select up to 12 active stores in manual mode.
- [x] Store-specific bulk purge with transaction locks, fresh record fingerprints, password reauthentication, expiring one-use preview and audit history. Revokes exclusive staff/fleet refresh and access tokens while preserving shared identities and unrelated store records. Active cross-store deliveries block deletion until reassigned.
- [x] Product flat/percentage discounts verified across quantities, repeated option lines, base-price-only discounts, per-offer caps, expiry/usage limits, coupon stacking and minimum spend after item discounts. Existing schema already supports product scope; no redundant promotion schema was introduced.
- [x] Additive, repeatable schema upgrade; verified database backup, URL normalization, environment synchronization, image rebuild and API/Admin restart.
- [x] Automated signed APK script for Customer, Merchant and Driver; interactive prompts only when local signing/configuration values are missing.

## Deploy existing 0.8/0.9 installations

```bash
cd /home/irenee/docker/Fida-marketplace
git switch feature/marketplace-business-delivery
git pull --ff-only origin feature/marketplace-business-delivery
bash scripts/update-platform.sh
```

To discard Docker build caches, run `FIDA_NO_CACHE=1 bash scripts/update-platform.sh` instead. Dependencies and the Prisma client are rebuilt inside the images. PostgreSQL tables, identities and recorded monetary values are preserved by the upgrade. It never invokes purge or RESET. Backups are stored outside the checkout in `../fida-backups/`.

For later environment synchronization after saving Master Settings:

```bash
bash scripts/reload-environment.sh
```

Provision DNS, TLS and reverse-proxy routing for a new host before changing PUBLIC_BASE_URL. Keep the stable bootstrap host available at `/v1/config` so installed clients can discover the current endpoint; offline clients cannot discover a host after their only known endpoint is removed. Install 0.10 APKs to gain dynamic routing; earlier APKs do not contain the observer. Existing in-flight provider checkout links remain provider-owned and are not rewritten. API configuration caching is at most five seconds per instance; mobile refresh is at most 30 seconds between requests, with forced refresh when opening the business platform.

Store purge removes database-owned operational records, including logical relations that lack foreign keys. It preserves customer/shared user identities, unrelated orders, administrator audit history and files on disk. Retained customer identities may sign in again; revoked tokens cannot be reused. Store purge has no 5,000-row application cap; generic non-store cascades retain the existing cap. Large purges still require a maintenance window because transaction locks block concurrent writes. No production deletion was performed.

## Compile signed APKs

```bash
bash scripts/build-apks.sh all
```

Requires a working Flutter/Android/JDK toolchain, the existing release keystore and matching Firebase configuration per app. Output: `dist/android/fida-{customer,merchant,driver}-<version-code>.apk`. For unattended execution, supply these through the secure build environment:

- `FIDA_LOCAL_KEYSTORE`, `FIDA_LOCAL_KEY_ALIAS`, `FIDA_LOCAL_STORE_PASSWORD`, `FIDA_LOCAL_KEY_PASSWORD`.
- `FIDA_CUSTOMER_GOOGLE_SERVICES_FILE`, `FIDA_MERCHANT_GOOGLE_SERVICES_FILE`, `FIDA_DRIVER_GOOGLE_SERVICES_FILE` when the matching file is absent from `android/app/google-services.json`.
- Optional `FIDA_API_BASE_URL` (stable bootstrap host), `FIDA_BUILD_NUMBER` (must exceed installed version codes).

GitHub mobile workflows resolve dependencies, analyze/test and compile on this branch. Signing requires the existing release-signing secrets; without them workflows label artifacts as debug. Local scripts require release signing and never silently produce a debug APK.

## Verification and precise remaining checklist

API typecheck and Admin production build pass. Integration verification includes public origin switching, normalization conflict rollback, ranking and manual overrides, scoped promotions, a 5,001-event purge, deliberately failed purge rollback, cross-store preservation and token revocation. The SQL upgrade is applied twice in a temporary database to verify repeatability. Destructive tests use temporary PGlite databases only. Android analyzer/widget/build results are recorded in GitHub Actions for the release commit.

| Priority | Remaining feature or acceptance | Current boundary |
|---|---|---|
| P0 | Real-device Android/Firebase acceptance | Push, background location under vendor battery restrictions, call/navigation intents and upgrade signing need physical-device checks. |
| P0 | Live payment acceptance | Merchant subaccount destinations, provider refund receipt and reconciliation need live-provider acceptance. No live money test performed. |
| P1 | Shared rate limiting, load and recovery | Rate limits are per-process; multi-replica tests and backup restoration drills remain. |
| P1 | Accounting extensions | Refund/settlement records exist; automated provider refunds, invoice-specific remittance allocation and fiscal EBM integration remain. |
| P2 | Advanced navigation and native onboarding | Directions launch external navigation. Traffic-aware embedded directions, dynamic ETA and multi-stop optimization remain; registration uses the secure web funnel. |
| P2 | Staff credential recovery | Self-service password recovery and owner reset UI remain absent. |
| P3 | Additional marketplace modules | SMS/social login, subscriptions and conversion analytics remain absent. |

`python3 scripts/audit-roadmap.py` checks repository source inventory and feature evidence. `ROADMAP-AUDIT-0.10.json` is a source audit, not proof of full industry feature parity or production acceptance.
