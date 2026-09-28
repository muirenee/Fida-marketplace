# Work checkpoint — 0.14

Baseline: `ccd41160d07e2e4614bb0cd76f63ad44e500c4d1`.
Branch: `feature/marketplace-business-delivery`.
Upstream reference: `389481597ff253c5178e38c316bf646746e91695`.

## Completed source work

- Native iOS projects and EAS custom Flutter workflows for all three apps.
- Unsigned simulator, signed internal and App Store cloud profiles.
- iOS-only Firebase validation, APNs readiness and cancellation, Apple background GPS settings.
- Offline configuration tests and CI checks. Flutter regressions added to Android CI.
- Native Flutter template license retained; no Enatega source, secrets, analytics accounts or proprietary API imported.

## Pending gates

- Expo account/project IDs/environment setup; first EAS cloud simulator compilation.
- Apple Developer team/certificates/registered UDIDs for physical-device preview; matching iOS Firebase registrations and APNs key in Firebase.
- Verify simulator provider compatibility, physical iOS push, GPS with screen locked, go-offline cancellation, keychain persistence, photo upload and receipt printing.
- CI analysis/tests/build results will be recorded after the source commit.
- `docs/ENATEGA-GAPS-0.14.md` lists remaining upstream/roadmap gaps; full architectural parity is not implemented.

Resume by reading this file, current Git status, CI and `IOS-CLOUD-0.14.md`. Do not overwrite existing Android signing identities. No production migrations or payment operations were run. No unattended future wake-up has been scheduled.
