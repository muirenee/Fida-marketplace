# 0.15 checkpoint

Completed source: dynamic store category schema, admin CRUD, public/merchant catalog, registration and app selectors; protected per-store order reset with password, terminal-only/paused-store checks, fresh five-minute single-use preview, transaction/table locks and audit history; repeatable migration and backup-first upgrade script.

Pending: cross-product reward calculation/UI; DINE_OUT checkout and merchant completion; delivery-only per-unit markup; final 0.15 mobile version/builds and regression checks. Schema columns are prepared, not yet active features. Continue from this commit. Preserve merchant-owned fleets, direct merchant payments and inclusive tax. No production reset or migration was executed.

0.14 EAS cloud configuration CI passed on 87fa34a. Actual cloud builds still need Expo account/project linking. Physical iOS preview also requires an Apple Developer team, registered devices, and matching iOS Firebase/APNs setup. Remaining upstream gaps remain documented in ENATEGA-GAPS-0.14.md. No unattended credit-reset wake-up is scheduled.
