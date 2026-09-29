# 0.15 execution checkpoint

Source implemented: cross-product Buy X/Get 1 free calculation, merchant app/portal selectors and badges, Dine Out end-to-end fulfillment, delivery-only per-unit markup with inclusive tax, protected store-order reset, dynamic store categories, repeatable migration and backup-first update script. Merchant-owned fleets/direct merchant payments are preserved. No production migration or purge executed.

Validation: 54 integration/migration tests, API/admin TypeScript checks, three offline iOS configuration tests and shell syntax passed. Source evidence sweep saved in ROADMAP-AUDIT-0.15.json. All 22 Customer tests and the Merchant/Driver regression suites passed in CI. Read git status and current GitHub branch before resuming. Workspace snapshots can revert; restore the latest remote commit first.

Release verified on 2026-09-29:
- Customer: source 24fa9bd073ac0f12c7ef0893247ddeb23127dead, successful run 36522040832, APK artifact 11012853410.
- Merchant: source 565df091a575716ec87ef67489cb871dd8856c0a, successful run 36446192061, APK artifact 10980713543.
- Driver: source 565df091a575716ec87ef67489cb871dd8856c0a, successful run 36446192128, APK artifact 10981087659.
- Validate: successful run 36522040833 (API/schema/admin build and iOS cloud configuration).
- APK hashes, package identifiers, version codes and matching previous-release certificate fingerprints are in APK-VERIFICATION-0.15.json. Downloaded ZIP hashes match GitHub artifact digests. Certificate identity inspection is not a physical-device install test.
- CI fixes: corrected customer header nesting, constrained the payment dropdown on narrow screens, updated dynamic-category fixtures and their UTF-8 encoding.

Next: deploy the platform with the command in RELEASE-0.15.md, install the signed APKs, and perform device/provider acceptance. No production rollout, production purge or physical-device testing was performed by this release task.

0.14 EAS cloud configuration CI passed on 87fa34a. Actual cloud compilation still needs Expo account/project linking; physical iOS preview additionally requires Apple Developer team, devices and matching iOS Firebase/APNs setup. Remaining upstream gaps are in ENATEGA-GAPS-0.14.md. No unattended credit-reset wake-up is scheduled.
