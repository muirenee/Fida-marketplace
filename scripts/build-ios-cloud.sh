#!/usr/bin/env bash
set -euo pipefail
FIDA_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIDA_ROLE="${1:-all}"
FIDA_PROFILE="${2:-development-simulator}"
case "$FIDA_ROLE" in customer|merchant|driver|all) ;; *) echo 'Usage: build-ios-cloud.sh [customer|merchant|driver|all] [development-simulator|preview|production]' >&2; exit 2;; esac
case "$FIDA_PROFILE" in development-simulator|preview|production) ;; *) echo 'Unknown cloud profile' >&2; exit 2;; esac
FIDA_ROLES=(customer merchant driver)
if [[ "$FIDA_ROLE" != all ]]; then FIDA_ROLES=("$FIDA_ROLE"); fi
for role in "${FIDA_ROLES[@]}"; do
  (
    cd "$FIDA_REPO_ROOT/apps/$role-mobile"
    # Interactive account/project setup is handled by EAS; no credentials are stored here.
    npx --yes eas-cli@24.8.0 build --platform ios --profile "$FIDA_PROFILE" --clear-cache
  )
done
