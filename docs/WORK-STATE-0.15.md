# 0.15 execution checkpoint

Source implemented: cross-product Buy X/Get 1 free calculation, merchant app/portal selectors and badges, Dine Out end-to-end fulfillment, delivery-only per-unit markup with inclusive tax, protected store-order reset, dynamic store categories, repeatable migration and backup-first update script. Merchant-owned fleets/direct merchant payments are preserved. No production migration or purge executed.

Validation: 54 integration/migration tests, API/admin TypeScript checks, three offline iOS configuration tests and shell syntax passed. Source evidence sweep saved in ROADMAP-AUDIT-0.15.json. Customer/merchant Flutter regression tests added; GitHub builds/CI results are the next gate. Read git status and current GitHub branch before resuming. Workspace snapshots can revert; restore the latest remote commit first.

Next: inspect CI for this source commit, fix any concrete failures, confirm signed customer/merchant/driver APK artifacts, and append run/artifact IDs here. Platform update command is in RELEASE-0.15.md. Do not claim production rollout or physical-device testing.

0.14 EAS cloud configuration CI passed on 87fa34a. Actual cloud compilation still needs Expo account/project linking; physical iOS preview additionally requires Apple Developer team, devices and matching iOS Firebase/APNs setup. Remaining upstream gaps are in ENATEGA-GAPS-0.14.md. No unattended credit-reset wake-up is scheduled.
