#!/usr/bin/env bash
set -euo pipefail
[[ "${EAS_BUILD:-}" == true && "${EAS_BUILD_PLATFORM:-}" == ios && "$(uname -s)" == Darwin ]] || {
  echo 'This script runs exclusively on an EAS iOS cloud worker.' >&2; exit 1;
}
case "${FIDA_IOS_SIMULATOR:-}" in 0|1) ;; *) echo 'Invalid iOS target.' >&2; exit 1;; esac
[[ "${FIDA_API_BASE_URL:-}" == https://* ]] || { echo 'Set FIDA_API_BASE_URL to your HTTPS API URL in EAS.' >&2; exit 1; }
FIDA_REPO_ROOT="$(git rev-parse --show-toplevel)"
FIDA_FLUTTER_ROOT="${TMPDIR:-/tmp}/fida-flutter-3.35.7"
if [[ ! -x "$FIDA_FLUTTER_ROOT/bin/flutter" ]]; then
  git clone --depth 1 --branch 3.35.7 https://github.com/flutter/flutter.git "$FIDA_FLUTTER_ROOT"
fi
export PATH="$FIDA_FLUTTER_ROOT/bin:$PATH"
set-env PATH "$PATH"
flutter config --no-analytics --no-enable-swift-package-manager
flutter precache --ios
flutter clean
flutter pub get
python3 "$FIDA_REPO_ROOT/scripts/eas/configure-ios.py"
swift "$FIDA_REPO_ROOT/scripts/eas/generate-ios-icons.swift" "$PWD/ios/Runner/Assets.xcassets"
flutter analyze --no-fatal-infos --no-fatal-warnings
FIDA_BUILD_NUMBER="$(($(date -u +%s) - 1577836800))"
if [[ "$FIDA_IOS_SIMULATOR" == 1 ]]; then
  flutter build ios --simulator --debug --no-codesign --build-number="$FIDA_BUILD_NUMBER" \
    --dart-define="FIDA_API_BASE_URL=$FIDA_API_BASE_URL" --dart-define-from-file=firebase-defines.json
  mkdir -p build/eas
  tar -czf build/eas/Fida-Simulator.tar.gz -C build/ios/iphonesimulator Runner.app
else
  # Generate Flutter assets and native dependencies before EAS signs/archives Runner.
  flutter build ios --release --no-codesign --build-number="$FIDA_BUILD_NUMBER" \
    --dart-define="FIDA_API_BASE_URL=$FIDA_API_BASE_URL" --dart-define-from-file=firebase-defines.json
fi
