#!/usr/bin/env bash
# Usage: bash scripts/build-apks.sh [all|customer|merchant|driver]
set -euo pipefail
cd "$(dirname "$0")/.."
# Android builds use Flutter; iOS uses the separate custom EAS cloud profiles.
for app in customer merchant driver; do
  [[ -f "apps/$app-mobile/pubspec.yaml" ]] || { echo "Missing Flutter application: $app" >&2; exit 1; }
done
# Use a stable bootstrap endpoint; installed apps learn subsequent routing from /v1/config.
export FIDA_API_BASE_URL="${FIDA_API_BASE_URL:-https://marketplaceadmin.fidalix.com}"
exec bash scripts/build-android.sh "${1:-all}" apk
