# 0.13 pricing and product offers

## Changed contracts

- `Promotion.buyQuantity`: integer 1–50; `getQuantity` remains 1; BOGO requires an owned active product. Existing active BOGO promotions now add rewards to the paid quantity instead of discounting units already in the cart.
- Input item `quantity` means paid units. Buy 2 with 2 paid units creates one additional reward. Rewards never qualify for further rewards. With multiple configurations, the cheapest qualifying configuration is rewarded first. The complete selected configuration is free, including its extras. Monetary caps permit only whole rewards. Existing best-item-offer, expiry, redemption, minimum-spend and stacking restrictions still apply.
- `options` accepts legacy name strings or `{name, quantity}` objects. Paid extra quantities are 1–20 per parent item; zero-price choices permit 1. Distinct-choice group limits still apply. Prices come only from the server. Each order item stores base unit price and modifier rows with total quantities/costs; reorders preserve selections but exclude old reward rows.
- New prices/rates include merchant tax. `tax = total - total / (1 + taxPercent / 100)`, rounded to cents and allocated across net item lines and delivery. `total = subtotal - discount + deliveryFee`. Rewards appear at gross value in subtotal with an equal discount. They have no tax. Included tax never increases cash due or commission.
- Existing orders retain `taxInclusive=false` and their original monetary values. New orders use `true`, with tax-rate and delivery-tax snapshots. Existing issued receipts are immutable. New receipts show included tax informationally; full credit notes retain its negative included-tax amount.
- Preview `quoteHash` fingerprints actual item quantities, configurations, rewards, tax and total. New clients submit `confirmedQuote`; a changed quote returns 409 for review even when the amount due stays constant. Legacy clients may still submit only their confirmed total; update the three apps after the backend upgrade.

## Files

Schema: `packages/database/prisma/schema.prisma`, `packages/database/prisma/upgrades/20260927-013-schema.sql`.
API: `lib/checkout.ts`, `lib/product-options.ts`, `lib/public-promotions.ts`, `lib/documents.ts`, `lib/finance.ts`; routes `orders.ts`, `reorder.ts`, `promotions.ts`, `marketplace.ts`, `merchant.ts` under `apps/api/src`.
Views: customer Product/Cart/Checkout/Reorder/Orders/Marketplace/Merchant screens; `packages/mobile_common/lib/product_offer.dart`, PDF document view; admin merchant promotions/business/options/document views.
Scripts: root `build-apks.sh`, root `update-platform.sh`, `scripts/build-apks.sh`, `scripts/build-android.sh`, `scripts/update-platform.sh`.

## Deploy platform, then apps

```bash
cd /home/irenee/docker/Fida-marketplace
git switch feature/marketplace-business-delivery
git pull --ff-only origin feature/marketplace-business-delivery
bash update-platform.sh
```

The script builds images, verifies a database backup, applies additive migrations transactionally, normalizes owned URLs, synchronizes approved runtime variables without replacing credentials, restarts API/admin and checks health. Set `FIDA_NO_CACHE=1` to rebuild without Docker cache. No operational tables are purged.

```bash
bash build-apks.sh
# One app:
bash build-apks.sh customer
```

Uses the installed Flutter/Android SDK, original release keystore and matching Firebase files, `flutter clean`, dependency resolution, analysis/tests and release APK compilation. `FIDA_API_BASE_URL` overrides the bootstrap endpoint; `FIDA_BUILD_NUMBER` can set a higher Android version code. Output: `dist/android/`. The existing GitHub workflows build all three signed apps automatically.

There is no EAS profile or Expo application in this repository. `eas build --platform android` cannot compile these Flutter apps. Enatega is the workflow reference, not the application runtime; source comparison and remaining gaps are in `ENATEGA-ADAPTATION-0.12.md` and `WORK-STATE-0.13.md`.
