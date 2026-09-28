# Fida 0.14 — EAS Cloud iOS

## Implemented files

- `apps/{customer,merchant,driver}-mobile/ios/`: Flutter 3.35.7 native Runner projects, shared scheme, iOS 15 minimum, CocoaPods, secure-storage keychain entitlement, privacy strings and Fida icon generation. Native template license: `docs/licenses/Flutter-BSD.txt`.
- Each app's `app.json`, `package.json`, `eas.json`, `.eas/build/ios-{simulator,device}.yml`: EAS metadata and custom Flutter cloud builds; no React Native runtime or Expo prebuild.
- `scripts/build-ios-cloud.sh`: submits cloud jobs from Linux/Windows Bash; rejects unknown profiles. No local build option.
- `scripts/eas/prepare-ios.sh`, `configure-ios.py`, `generate-ios-icons.swift`: EAS-worker-only Flutter installation, native dependencies, permissions, exact Firebase bundle validation, branding, unsigned simulator archive or assets for EAS-managed signing.
- `apps/driver-mobile/lib/location_settings.dart`: Apple background tracking, visible indicator, no automatic pausing. Existing Android foreground service retained.
- `packages/mobile_common/lib/apple_push.dart`, `fida_mobile_common.dart`: platform-specific Firebase bundle ID, bounded APNs readiness, sign-out cancellation, retry after app resume. Unsigned simulators disable FCM.
- `tests/ios-configuration.py`, `tests/eas-configuration.cjs`: permissions, signing separation, Firebase isolation, idempotence, actual EAS profile/workflow/native-target validation.

## Build profiles

| Profile | Artifact | Apple requirements |
|---|---|---|
| `development-simulator` | `.tar.gz` containing an unsigned `Runner.app` built in Flutter debug mode | No Apple team or certificate. Expo account/project and EAS quota required. |
| `preview` | Signed ad-hoc `.ipa`, `distribution: internal` | Apple Developer membership, signing certificate, registered device UDIDs and provisioning profile. |
| `production` | Signed App Store `.ipa` | Apple Developer membership and distribution credentials. Store submission/review is separate. |

`developmentClient` is deliberately **false**. EAS CLI 24.8.0 rejects `true` without `expo-dev-client`; that React Native client cannot supply a Flutter runtime. The simulator profile satisfies unsigned cloud compilation through a custom Flutter workflow. Enabling the requested Expo development client requires an actual application migration, not a manifest flag.

The archive needs a native iOS Simulator host (including a compatible hosted simulator service). It is not an iPhone-installable IPA or a browser application. Compatibility with a particular hosted service and simulator architecture requires that service's validation. Simulator success cannot verify physical-device APNs or background GPS.

## First build, from Linux/Windows Bash

```bash
git switch feature/marketplace-business-delivery
git pull --ff-only origin feature/marketplace-business-delivery
npx --yes eas-cli@24.8.0 login
for app in customer merchant driver; do
  (
    cd "apps/$app-mobile"
    npx --yes eas-cli@24.8.0 init
    npx --yes eas-cli@24.8.0 env:create --environment preview --name FIDA_API_BASE_URL --value https://marketplaceadmin.fidalix.com --visibility plaintext
  )
done
bash scripts/build-ios-cloud.sh all development-simulator
```

EAS prompts to create/link each Expo project on first use and writes its real project ID to that app's `app.json`. Keep those IDs in your branch; no IDs, Apple team or keys have been invented. Use the `preview` EAS environment in each project to set `FIDA_API_BASE_URL` to the HTTPS backend URL before building. Existing Android GitHub/Firebase secrets are not automatically copied into EAS.

For unattended builds, use an authorized `EXPO_TOKEN` and linked project IDs. The submitted archive includes the complete monorepo, including `packages/mobile_common` and `scripts`; do not exclude them in `.easignore`. Native `.xcodeproj` files must remain included so EAS identifies the apps as generic native projects.

## Enable physical-device testing later

1. Register these three **iOS** Firebase apps in the existing Firebase project:
   - Customer: `com.fidalix.marketplace.customer`
   - Merchant: `com.fidalix.marketplace.merchant`
   - Driver: `com.fidalix.marketplace.driver`
2. For each EAS project/environment, upload its matching `GoogleService-Info.plist` as a secret **file** variable named `FIDA_FIREBASE_IOS_PLIST`. The worker uses its injected file path to generate Dart options. Android `google-services.json` and Android Firebase app IDs are invalid here.
3. Configure the Apple team and distribution credentials through EAS credentials management. Register test devices for the ad-hoc profile. EAS provisions the native Runner target; the device profiles do not bypass credentials.
4. Enable Push Notifications for each Apple App ID and upload your Apple APNs authentication key/key ID/team ID to **Firebase Cloud Messaging** for the existing project. Fida sends through Firebase, so an Expo push credential alone is insufficient. Keep `.p8`, `.p12`, provisioning profiles and service-account keys out of Git.
5. Set `FIDA_API_BASE_URL` in the selected EAS environment, then submit:

```bash
bash scripts/build-ios-cloud.sh all preview
```

With no Apple Developer setup, use `development-simulator` only. Permissions do not remove Apple's signing requirements. Maps use the existing Flutter map/tile provider and native geocoding; no unused Google Maps key is injected.

## Verification boundary

Offline EAS 24.8.0 schema, custom YAML, native scheme/target/bundle/entitlement parsing pass for all nine app/profile combinations. Python configuration regressions pass. Cloud compilation has not been submitted: no Expo authentication/project link is available in this session. Signed IPA/APNs/device GPS acceptance is also pending the account/provider setup above. Native signing or compiler success is not claimed from static checks.

References:
- https://docs.expo.dev/custom-builds/get-started/
- https://docs.expo.dev/custom-builds/schema/
- https://docs.expo.dev/build-reference/simulators/
- https://docs.expo.dev/build/internal-distribution/
- https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/build/utils/devClient.ts
- https://firebase.google.com/docs/cloud-messaging/flutter/get-started
- https://pub.dev/packages/geolocator

No database migration or platform restart is needed for these iOS configuration changes. Existing Android build and platform-update scripts remain available.
