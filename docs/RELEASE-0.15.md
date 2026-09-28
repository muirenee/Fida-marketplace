# Fida 0.15.0

## Included
- Cross-product Buy X/Get 1 free offers: merchant catalog dropdowns in app and portal, product image badges naming the reward, server-side thresholds/caps/availability/ownership validation, free existing cart units or automatic plain-product rewards. Required options produce a checkout hint; configured rewards include selected extras within the offer cap. Free units never trigger another offer. One winning item offer per trigger, processed in stable product order; paid trigger units are reserved against overlapping reward claims.
- Delivery, Pickup and Dine Out discovery, store, cart, checkout and merchant completion flows. Enable Dine Out per branch. Dine Out has no delivery fee, driver dispatch or delivery PIN, and follows Accept → Preparing → Ready to serve → Complete. Receipts and commission invoices use the existing completion pipeline.
- Merchant-defined delivery markup per food unit, visible in menu/detail/cart and recomputed by the server. Pickup and Dine Out retain base prices. Taxes are extracted from the discounted gross amount; they are never added to the amount due. Quotes detect changed mode, prices and rewards.
- Platform-owned dynamic store categories and root CRUD. Removing a category leaves stores/menu intact and uncategorized. Migration maps the old fixed Pharmacy category to Other once; it does not recreate deleted categories on repeat runs.
- Protected Reset Store Orders: root password, reason, five-minute single-use preview, exact typed confirmation, paused store, no active orders, fingerprint freshness, transaction/table locks. Clears selected store order items, delivery assignments, reviews, notifications, payment records, support/refund records, receipts and commission ledgers/periods. Store, branch, menu, settings, staff, drivers, promotions and audit history remain. External provider transactions are not refunded or deleted.

## Platform upgrade
Run from the existing server checkout. The script verifies a backup, builds images, applies repeatable migrations, briefly stops API/admin for the category cutover, normalizes owned URLs, reloads approved runtime environment values and recreates services. It does not reset any orders automatically.

```bash
cd /home/irenee/docker/Fida-marketplace
git pull --ff-only origin feature/marketplace-business-delivery
bash scripts/update-platform.sh
```

If the upgrade exits after stopping services, inspect the reported error and backup before restarting. Do not run db push on production.

## Android
GitHub Customer Mobile, Merchant Mobile and Driver Mobile workflows compile signed APKs using the existing repository signing secrets. Install backend 0.15 before these apps. For an already configured local Flutter/Android SDK and signing environment:

```bash
bash scripts/build-apks.sh all
```

## iOS
Existing custom EAS cloud Flutter profiles remain configured. Run `bash scripts/build-ios-cloud.sh all development-simulator` after linking the three Expo projects and configuring their environment. Physical-device preview requires Apple Developer signing, registered UDIDs and matching iOS Firebase/APNs setup. No local Xcode commands or new signing identities are generated.

## Acceptance
API/admin typechecks, 54 integration/migration tests, three offline iOS configuration tests and shell syntax checks passed locally. Flutter UI tests and all Android artifacts are verified in CI after commit. Physical-device checkout, push/background GPS and live provider payments still require deployment/device acceptance. This release does not claim complete Enatega parity; remaining modules are listed in ENATEGA-GAPS-0.14.md and ROADMAP-AUDIT-0.15.json.
