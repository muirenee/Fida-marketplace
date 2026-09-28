# Upstream comparison — 2026-09-28

Verified upstream commit: `389481597ff253c5178e38c316bf646746e91695`.
Dependency and source-path inventory: `upstream-enatega-0.14.json`.

Fida has `apps/{customer,merchant,driver}-mobile` (Flutter), `apps/admin-web` (Next 16), and `apps/api` (Fastify/PostgreSQL). No active `enatega-multivendor-*` React Native trees exist here. Upstream customer/rider use Expo 53 and merchant Expo 54; its admin uses Next 14. Copying those dependency matrices would not migrate the Flutter application. The upstream README explicitly withholds its proprietary API/backend; complete server architectural parity cannot be verified from this public repository.

## Missing native capabilities implemented

| Upstream evidence | Fida missing/incomplete path | 0.14 result |
|---|---|---|
| `enatega-multivendor-{app,store,rider}/eas.json` | All three Fida apps lacked `eas.json` and `ios/` | Native Runner projects, custom EAS workflows, simulator/ad-hoc/store profiles added. |
| Customer Firebase messaging; merchant/rider Expo notifications in their `package.json` | `packages/mobile_common/lib/fida_mobile_common.dart` had Android Firebase options and immediate FCM token access | iOS bundle options, APNs readiness, cancellation and resume retry added. Device setup still required. |
| Rider `expo-location` and `expo-task-manager` dependencies | `apps/driver-mobile/lib/main.dart` always used `AndroidSettings` | AppleSettings and native background permissions added; online/offline scope retained. |
| Store `expo-image-picker` dependency | Merchant lacked iOS photo/camera privacy strings | `apps/merchant-mobile/ios/Runner/Info.plist` configured for existing image picker. |
| Native secure storage dependencies | All three apps lacked keychain entitlements | `ios/Runner/Runner.entitlements` includes app-scoped access group. |

## Still missing or intentionally different

| Priority | Upstream evidence | Fida target/current gap |
|---|---|---|
| P0 | iOS native runtime | First cloud compiler/signing execution remains unverified without an Expo account/project; real-device APNs and GPS require Apple/Firebase setup. |
| P0 | Proprietary upstream API | No public backend schema/controllers to extract. `apps/api/` remains independently implemented and tested. |
| P1 | `enatega-multivendor-rider/app/chat/index.tsx`, `lib/ui/screens/chat/index.tsx`; customer/rider `react-native-gifted-chat` | No in-app order chat schema, authorized conversation API or customer/driver chat screens. Phone calling/support cases exist. |
| P1 | Customer `translations/`, merchant/rider `languages/`, admin `next-intl` | No full translation catalogs/provider in Fida mobile apps; complete localization and accessibility acceptance remain open. |
| P1 | Customer Apple/Google sign-in dependencies | `apps/api/src/routes/auth.ts` and customer auth screen have no verified Apple/Google token exchange/account-linking flow. OAuth clients/provider configuration required. |
| P1 | Upstream Apollo subscriptions/GraphQL state controllers | Fida merchant polls/push-refreshes; no socket reconnect reconciliation. Queue pagination also remains open from 0.12. GraphQL is not required to preserve Fida REST contracts. |
| P1 | `enatega-multivendor-web/` | No full customer web storefront; Fida web app serves admin/merchant operations. |
| P1 | Customer/rider Sentry; customer Amplitude/Clarity dependencies | No configured crash/analytics integration or project keys/consent policy. Upstream telemetry accounts were not copied. |
| P1 | Existing Fida financial roadmap | `apps/api/src/routes/payments.ts`: provider refund execution/reconciliation and EBM fiscal integration remain open; commercial receipts are not fiscal certification. |
| P2 | Merchant `react-native-thermal-printer` | Fida supports PDF/printing via `packages/mobile_common/lib/document_screen.dart`; direct thermal printer hardware protocol support is absent. |
| P2 | Rider maps/directions dependencies | Fida live map and external turn-by-turn navigation exist; traffic-aware embedded routing, multi-stop optimization and dynamic ETA remain open. |
| Preserved architecture | Upstream Stripe/wallet/withdrawal flows | Keep merchant-owned fleets, customer-to-merchant payments and commission invoice logging. Importing platform-owned fleets or central wallet payouts would violate the requested business architecture. |

No claim of 100% marketplace or architectural parity. Remaining modules above are not marked complete merely because corresponding upstream dependencies exist.

## Prior packages retained

0.12: reorder validation, active/history scopes, merchant queue/search/counts and driver pickup/dropoff summary. 0.13: product-level buy-X-get-one rewards, tax-inclusive checkout, modifier quantities, quote fingerprints and receipt/credit accounting. Their regression suites remain in CI. No migration, historical financial rewrite or live provider transaction was executed for 0.14.
