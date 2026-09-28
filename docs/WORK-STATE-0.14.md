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

## Compatibility correction

Flutter 3.35.7 failed dependency resolution: geolocation/secure-storage transitive packages require Dart >=3.10. EAS and its CI gate now pin Flutter 3.41.6 (upstream tag db50e20168db8fee486b9abf32fc912de3bc5b6a). Native templates retain their 3.35.7 origin/license.

0.14 Android Customer, Merchant, Driver builds passed on source 381efab.

## Newly authorized next package

0.15: isolated store-order reset and dynamic store categories first; cross-product buy-X-get-Y rewards and catalog selectors; DINE_OUT fulfillment end-to-end; delivery-only per-unit merchant markup. Preserve store/menu/configuration data during order resets, direct payments, and inclusive tax.
