# Fida 0.11.0 (Android version code 12)

## Promotion locations
- `packages/database/prisma/schema.prisma`: Promotion, productId, discountType, buyQuantity/getQuantity.
- `packages/database/prisma/upgrades/20260922-011-schema.sql`: additive migration, BOGO scope constraint and lookup index.
- `apps/api/src/routes/promotions.ts`: merchant creation, validation, pause/activate; platform promotion policy.
- `apps/api/src/lib/checkout.ts`: server-authoritative item discount, tax and coupon stacking.
- `apps/api/src/lib/public-promotions.ts`: excludes unavailable products, exhausted offers and invalid scopes.
- `apps/admin-web/app/merchant/page.tsx`: Promotions editor (also opened from the Merchant App business portal).
- `apps/admin-web/app/business-operations/promotion-policy.tsx`: platform promotion policy.

BOGO quantities include the free units: 2 units = 1 free; 3 = 1 free; 4 = 2 free. Add-ons are charged on every unit. Maximum discount admits whole free units, not a partial free item. Expiry, redemption limits, minimum spend and stacking policy still apply. Only the best eligible item promotion is used; server totals must be confirmed before ordering.

## Customer changes
- `lib/screens/delivery_pin_screen.dart`: tap/drag/map-pan pin, debounced native reverse geocoding, editable address fallback, current location and save.
- `lib/screens/addresses_screen.dart`: create/edit map coordinates and text.
- `lib/screens/marketplace_screen.dart`: default-address delivery eligibility and BOGO horizontal row/badges.
- `lib/screens/checkout_screen.dart`: pin editing and suppression of zero optional lines; stale quote responses ignored.
- `packages/mobile_common/lib/document_screen.dart`, `apps/admin-web/app/merchant/document-view.tsx`: same rule for receipts/invoices. Subtotal and Total remain visible.

Native Android/iOS geocoding uses the device service; no new server API key is needed. If lookup fails or the service is absent, the customer can enter the address manually while retaining the coordinates. Map tiles use FIDA_MAP_TILE_URL or the existing OpenStreetMap default. Reference image image_yDsKLI.png was unavailable; cards follow the existing Fida style. Live native geocoding and real-device pin gestures still need operator acceptance.

## Upgrade the Docker platform first
```bash
cd /home/irenee/docker/Fida-marketplace
git switch feature/marketplace-business-delivery
git pull --ff-only origin feature/marketplace-business-delivery
bash scripts/update-platform.sh
```
The script builds API/admin images, creates and verifies a database backup, applies additive migrations, normalizes owned URLs, preserves credentials while applying runtime settings, restarts services and checks health. It does not reset data.

## Signed APKs
Existing GitHub customer/merchant/driver workflows build on this branch using the configured signing and Firebase secrets. Local build uses the existing configured Android/Flutter environment:
```bash
bash scripts/build-apks.sh
```
Review `scripts/build-android.sh` for environment variables and signing requirements. Do not change the existing signing key when updating installed apps.

## Verification / resumption
See `docs/WORK-STATE-0.11.md`. Tests run against isolated PGlite data, never production. Credit resets cannot wake an inactive session; this checkpoint supports the next active turn.
