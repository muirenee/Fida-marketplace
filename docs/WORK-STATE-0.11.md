# Fida 0.11 completion checkpoint

Branch: feature/marketplace-business-delivery.
Final implementation: 7264d89be83b275ad34e660cc8569140aa320c27.

- [x] Product-specific BOGO schema, whole-pair pricing, caps, stacking and redemption limits.
- [x] Merchant promotion editor; Customer BOGO row, badges and product labels.
- [x] Owner-scoped map pin editing, native reverse geocoding and manual fallback.
- [x] Address-aware delivery eligibility; checkout pin preferences and eligible branch selection.
- [x] Hide zero optional amounts in checkout, order history, receipts and invoices.
- [x] Additive, repeatable migration and platform update script.
- [x] Local integration/migration tests (40), API/admin typechecks and shell syntax checks.
- [x] Final GitHub Customer analyzer/widget tests and signed APK build.
- [x] Merchant/Driver tests and signed APK builds; platform Validate passed.
- [x] All APK archive hashes, package IDs, version increases and v2 signatures verified.

CI: Customer 36308382920; Validate 36308382916; Merchant 36307816696; Driver 36307816648.
All three packages retain the existing signing certificate. APK metadata: docs/APK-VERIFICATION-0.11.json.
No production database changes executed. Operator deployment commands: docs/RELEASE-0.11.md.
Physical-device geocoding/installation acceptance remains with the operator.
Reference image image_yDsKLI.png was unavailable; store cards follow existing Fida styling.
Credit-reset events cannot wake an inactive session; this checkpoint supports resumption.
