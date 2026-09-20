# Fida Marketplace 0.9

## Implemented

- [x] Merchant landing registration link: https://fidalix.com.
- [x] Authenticated JPEG/PNG/WebP uploads: streaming limit 5 MB, decoded limit 16 MP, WebP re-encoding, user-owned asset records, no user-supplied filesystem paths.
- [x] Automatic normalized store slugs with serialized collision handling. Approved store URLs remain stable during metadata edits.
- [x] Native and web owner store/branding/branch editing. Owner/manager staff creation, name/role editing, suspension and deletion; manager branch isolation and owner-only reassignment.
- [x] Customer favorite JSON payload fix, permanent owned-address deletion and default-address reassignment.
- [x] Nine discovery sections, two-row horizontal nearby grid, authenticated recent stores, actual ratings/favorite counts/completed-order rankings and configurable featured stores.
- [x] Admin collections with typed edits, reauthentication, previewed cascading deletes, stale-preview rejection, audit logging and last-administrator protection.
- [x] Protected operational RESET with password, expiring one-use token and exact confirmation phrase. Preserves administrator accounts/sessions, settings and audit history. Uploaded files are retained; no production reset is performed by installation.
- [x] Date-range consolidated commission invoices referencing existing invoices/credits without additional ledger charges.
- [x] Live master settings: PUBLIC_BASE_URL, CORS_ORIGIN, ADMIN_ALLOWED_IPS, MAINTENANCE_MODE, FEATURED_STORE_IDS. Database values override environment defaults within five seconds. Secrets, database credentials and proxy trust remain deployment-only.
- [x] Additive 0.8→0.9 SQL upgrade, verified pre-upgrade backup, container dependency rebuild and environment synchronization scripts.

## Platform upgrade (existing 0.8 installation)

```bash
cd /home/irenee/docker/Fida-marketplace
git switch feature/marketplace-business-delivery
git pull --ff-only origin feature/marketplace-business-delivery
bash scripts/upgrade-0.9.sh
```

The script installs dependencies and regenerates Prisma inside new Docker images, applies the five new tables transactionally, restarts API/Admin and checks API health. It does not use `db push`, delete data or modify Firebase credentials. A partial migration stops the script. Backups are written outside the checkout in `../fida-backups/`.

Explicit clean rebuild:

```bash
FIDA_NO_CACHE=1 bash scripts/upgrade-0.9.sh
```

After saving Master Settings in `/system`, synchronize the same supported values to the server `.env` and recreate API/Admin containers:

```bash
bash scripts/reload-environment.sh
```

Keep the API private behind the reverse proxy. Set `TRUST_PROXY` only to its actual IP/CIDR before using client IP restrictions. For Admin requests forwarded through Next.js, the API sees the Next.js server connection; the displayed connection address reflects this. Enforce end-user IP restrictions at the edge if required. The master screen cannot change arbitrary secrets or reload reverse-proxy certificates/DNS.

## Android release builds

Install stable Flutter, Android SDK/toolchain and a compatible JDK; run `flutter doctor --android-licenses` and resolve `flutter doctor` failures. Use the existing release keystore and matching Firebase configuration for each Android package in the same Firebase project.

```bash
bash scripts/build-android.sh all apk
```

For Play Store bundles:

```bash
bash scripts/build-android.sh all appbundle
```

The script prompts for signing details and each missing `google-services.json`, scaffolds/configures Android, clears build caches, resolves dependencies, analyzes/tests and outputs `dist/android/`. The default API is `https://marketplaceadmin.fidalix.com`. Use `FIDA_API_BASE_URL` to override and `FIDA_BUILD_NUMBER` only when an explicit higher Android version code is needed. Preserve the existing signing certificate to update installed apps.

## Verification and remaining acceptance

Local: API typecheck, Admin production build, 30 SQL-backed/origin/migration tests, shell syntax and roadmap evidence sweep. CI runs Flutter analysis and Customer/Driver widget checks before APK builds. Tests execute cascade deletion and RESET only against a newly created temporary PGlite database.

| Priority | Remaining work | Scope |
|---|---|---|
| P0 | Physical Android acceptance | Verify deployed push, locked-screen GPS, vendor battery restrictions, call/navigation intents, upload picker, and signed APK upgrade with the real Firebase project. |
| P0 | Live payment acceptance | Verify provider merchant subaccounts, settlement destinations, refunds and reconciliation before enabling live online payments. No live money test was performed. |
| P1 | Load and recovery testing | Shared rate limiting, multi-replica behavior, backup restoration drill and large deletion maintenance windows. Interactive cascade previews are capped at 5,000 records. |
| P1 | Accounting extensions | Automated provider refunds/transfers, invoice-specific remittance allocation, fiscal EBM integration and jurisdiction-specific tax certification remain separate. |
| P2 | Native onboarding and advanced logistics | Registration remains the secure web funnel; traffic-aware embedded directions, dynamic ETA and multi-stop optimization remain unimplemented. |
| P2 | Staff recovery | Self-service password recovery and owner-initiated credential reset UI remain unimplemented. |
| P3 | Marketplace parity | SMS/social login, subscriptions and conversion analytics remain unimplemented. This release does not claim full Uber Eats feature or pixel parity. |

The roadmap JSON checks source evidence only. Rankings use available real data; location sections follow the selected city and do not claim GPS distance ranking or calculated ETAs.
