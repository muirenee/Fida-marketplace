# Fida 0.7 — Customer experience, live tracking and business documents

Source branch: `feature/marketplace-business-delivery`.

## Feature gaps addressed

| Area | Previous gap | Updated source |
|---|---|---|
| Customer discovery | Placeholder store art, nonfunctional location header, no offer/rating filters | `apps/customer-mobile/lib/screens/marketplace_screen.dart`; `apps/api/src/routes/marketplace.ts` |
| Store/menu | Small header, no menu search or branch selection | `screens/merchant_screen.dart` |
| Product choices | Optional checkboxes only; configurations overwrite each other | `screens/product_screen.dart`; `apps/api/src/lib/product-options.ts`; `routes/orders.ts` |
| Cart | View cart went straight to checkout | `screens/cart_screen.dart`; `screens/checkout_screen.dart` |
| Tracking | Text only; 15-second polling; driver location still exposed after completion | `screens/orders_screen.dart`; `packages/mobile_common/lib/delivery_map.dart`; `routes/orders.ts` |
| Addresses | Account entry could not open address management | `screens/addresses_screen.dart` |
| Merchant | No polling fallback if push is delayed; incomplete web business controls | Merchant `main.dart`, `catalog_page.dart`; portal `business-settings.tsx`, `option-editor.tsx`, `page.tsx` |
| Driver | No explicit background permission flow, no configured payout estimate | Driver `main.dart`; `scripts/configure_mobile.py`; `routes/driver.ts`; `lib/driver-pay.ts` |
| Documents | No generated customer receipt or commission invoice | `lib/documents.ts`; `routes/documents.ts`; shared `document_screen.dart`; portal `document-view.tsx` |

The supplied screens guide white surfaces, black primary buttons, large photos, rounded controls, horizontal discovery/menu lists, a dedicated customization page and cart. Fida branding, actual merchant photos, real ratings and real promotions are retained. There are no invented Uber memberships, discounts, arrival times or social-login buttons. Exact visual equivalence is not claimed; physical-device screenshots remain part of acceptance.

## Backend changes

- Public catalog adds cover image from an available product, aggregated ratings, usable promotions, timezone and branch opening state.
- Existing option arrays stay compatible. Optional group metadata: `group`, `minSelect`, `maxSelect`. Limits must agree within a group; the server checks required/exclusive choices and prices every configured cart line. Up to 50 units total of a product across configurations.
- Customer tracking uses the authenticated order-detail endpoint every five seconds. Pickup, drop-off and courier markers appear on a real street map. Driver coordinates are withheld after completion/cancellation/rejection. Stale updates are labelled; no straight line is presented as a road route or fabricated ETA.
- Merchant orders update from Firebase events with an eight-second foreground polling fallback. Stock changes persist immediately and checkout rejects sold-out products.
- Driver tracking uses the Android location foreground service with ongoing notification, wake lock, explicit background permission explanation, GPS stream and periodic stationary-position refresh. Tracking stops when going offline. Navigation continues in Google Maps. Android force-stop, revoking permissions or vendor battery restrictions can interrupt tracking; device tests are required.
- Operators configure base pay and per-delivery-km pay. Null means not configured, never an assumed promise of earnings. Claim/dispatch saves the agreed estimate on the delivery; later changes apply only to new assignments. `/v1/driver/earnings` lists completed deliveries; it does not execute payouts.
- Completion atomically issues an immutable customer receipt and per-order commission invoice with unique numbers. Repeated requests do not create duplicates. Completed legacy orders can generate documents on first request. Full refunds generate separate customer/commission credit notes where originals exist.
- Customer receipt: `GET /v1/customer/orders/:id/receipt`; merchant invoices: `GET /v1/merchant/documents`; legacy invoice: `POST /v1/merchant/orders/:id/invoice`; admin documents: `GET /v1/admin/business/documents`.
- PDF preview/share/print in Customer; print/save PDF in the portal. These are commercial documents, not RRA EBM fiscal documents. EBM signing/integration and automated financial transfers remain external integrations.

## Deployment from the working 0.6 server

Keep `PUBLIC_BASE_URL=https://marketplaceadmin.fidalix.com` in `.env`.

```bash
cd /home/irenee/docker/Fida-marketplace
git fetch origin
git switch feature/marketplace-business-delivery
git pull --ff-only origin feature/marketplace-business-delivery
bash scripts/upgrade-0.7.sh
```

The script builds both images, backs up PostgreSQL, applies only the new additive upgrade in one transaction, and recreates API/admin. It detects an already-applied upgrade and rejects partial schemas. Do not reapply the previous 0.6 SQL script on an already upgraded database. Keep the backup outside the repository. Install all three signed 0.7 APKs after updating the server.

Set merchant pay rates at **Merchant → Business → Driver pay estimates**. Fida fleet rates are under **Business operations → Fleet**. Existing drivers are not automatically assigned a pay rate.

Driver first use: allow notifications, enable location, then choose **Location → Allow all the time** in Android app settings and return to Fida. Go online to start sharing. Test with the screen locked and Google Maps open, then verify that going offline stops updates.

Default map tiles use OpenStreetMap with attribution and app identification. For higher-volume deployment, configure a suitable tile provider using the build-time `FIDA_MAP_TILE_URL` URL template and its corresponding attribution. The current default attribution is OpenStreetMap. Provider availability/network access are needed for street tiles.

## Verification

- API type checking and Next production build.
- Database-backed tests: browse, authorization, grouped choices/multiple configurations, sold-out checkout, promotion/tax/idempotency, PIN delivery, pay snapshots, live-location ownership/privacy, receipts/invoice isolation, refund credit notes, and payment verification replay.
- Additive schema upgrade exercised against a 0.6 schema.
- Customer Flutter widget tests cover Home, Store, required/exclusive choices, and independently removing configured cart lines. CI saves preview PNGs for visual review.
- GitHub Actions analyzes and builds all three signed Android apps. Physical-device push, background location and Google Maps tests still require the deployment and devices.

## Still requiring external setup or acceptance

Firebase delivery tests on real devices; payment-provider sandbox/live certification; EBM fiscal integration; automated bank/provider refunds and payouts; traffic-aware embedded routing/ETAs; SMS/Google authentication and subscriptions are not supplied by this release. Existing configured email authentication and external navigation remain the supported flows. Full production concurrency and Android vendor battery behaviour are not proven by the in-memory database/widget tests.
