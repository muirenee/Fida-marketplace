#!/usr/bin/env bash
# Linux/macOS: bash scripts/build-android.sh [all|customer|merchant|driver] [apk|appbundle]
set -euo pipefail
cd "$(dirname "$0")/.."
root=$(pwd)
role=${1:-all}
kind=${2:-apk}
case "$role" in all) roles=(customer merchant driver);; customer|merchant|driver) roles=("$role");; *) echo 'Choose all, customer, merchant or driver.' >&2; exit 1;; esac
case "$kind" in apk|appbundle) ;; *) echo 'Choose apk or appbundle.' >&2; exit 1;; esac
for program in flutter java python3 keytool; do command -v "$program" >/dev/null || { echo "Install $program first." >&2; exit 1; }; done
flutter doctor -v
require_value() {
  local name=$1 prompt=$2 secret=${3:-0}
  [[ -n "${!name:-}" ]] && return
  [[ -t 0 ]] || { echo "Set $name before running unattended builds." >&2; exit 1; }
  if [[ "$secret" == 1 ]]; then read -r -s -p "$prompt: " "$name"; printf '\n';
  else read -r -p "$prompt: " "$name"; fi
  [[ -n "${!name}" ]] || { echo "$name is required." >&2; exit 1; }
}
require_value FIDA_LOCAL_KEYSTORE 'Existing release keystore path'
FIDA_LOCAL_KEYSTORE=$(python3 -c 'import pathlib,sys; print(pathlib.Path(sys.argv[1]).expanduser().resolve(strict=True))' "$FIDA_LOCAL_KEYSTORE")
require_value FIDA_LOCAL_KEY_ALIAS 'Release key alias'
require_value FIDA_LOCAL_STORE_PASSWORD 'Keystore password' 1
require_value FIDA_LOCAL_KEY_PASSWORD 'Key password' 1
export FIDA_LOCAL_KEYSTORE FIDA_LOCAL_KEY_ALIAS FIDA_LOCAL_STORE_PASSWORD FIDA_LOCAL_KEY_PASSWORD
# Passwords go through the process environment, never shell arguments or printed logs.
keytool -list -keystore "$FIDA_LOCAL_KEYSTORE" -alias "$FIDA_LOCAL_KEY_ALIAS" -storepass:env FIDA_LOCAL_STORE_PASSWORD >/dev/null
api_base=${FIDA_API_BASE_URL:-https://marketplaceadmin.fidalix.com}
build_number=${FIDA_BUILD_NUMBER:-$(($(date -u +%s) - 1577836800))}
[[ "$build_number" =~ ^[0-9]+$ ]] && ((build_number > 0 && build_number < 2100000000)) || { echo 'Invalid Android build number.' >&2; exit 1; }
mkdir -p "$root/dist/android"
for current in "${roles[@]}"; do
  cd "$root/apps/$current-mobile"
  firebase_file="$PWD/android/app/google-services.json"
  if [[ ! -f "$firebase_file" ]]; then
    case "$current" in
      customer) config_variable=FIDA_CUSTOMER_GOOGLE_SERVICES_FILE ;;
      merchant) config_variable=FIDA_MERCHANT_GOOGLE_SERVICES_FILE ;;
      driver) config_variable=FIDA_DRIVER_GOOGLE_SERVICES_FILE ;;
    esac
    require_value "$config_variable" "Matching $current google-services.json path"
    firebase_file=${!config_variable}
  fi
  FIDA_FIREBASE_CONFIG_JSON=$(cat "$firebase_file")
  export FIDA_FIREBASE_CONFIG_JSON
  flutter create --platforms=android --project-name "${current}_mobile" --org com.fidalix.marketplace .
  python3 - <<'PY'
from pathlib import Path
p=Path('test/widget_test.dart')
if p.exists() and 'MyApp' in p.read_text() and 'counter' in p.read_text().lower():
    p.unlink()
for name in ('build.gradle.kts','build.gradle'):
    p=Path('android/app')/name
    if p.exists():
        p.write_text(p.read_text().replace('minSdk = flutter.minSdkVersion','minSdk = 23').replace('minSdkVersion flutter.minSdkVersion','minSdkVersion 23'))
PY
  python3 ../../scripts/configure_mobile.py
  python3 - <<'PY'
from pathlib import Path
import os
# Escape Java Properties syntax, including non-ASCII passwords.
def prop(value):
    result=''
    for char in value:
        if char in '\\:=#! ':
            result+='\\'+char
        elif char=='\n': result+='\\n'
        elif char=='\r': result+='\\r'
        elif char=='\t': result+='\\t'
        elif ord(char)>126:
            result+=''.join('\\u'+part.hex() for part in [char.encode('utf-16-be')[i:i+2] for i in range(0,len(char.encode('utf-16-be')),2)])
        else: result+=char
    return result
values={'storeFile':os.environ['FIDA_LOCAL_KEYSTORE'],'keyAlias':os.environ['FIDA_LOCAL_KEY_ALIAS'],'storePassword':os.environ['FIDA_LOCAL_STORE_PASSWORD'],'keyPassword':os.environ['FIDA_LOCAL_KEY_PASSWORD']}
p=Path('android/key.properties');p.touch(mode=0o600);p.chmod(0o600)
p.write_text(''.join(f'{key}={prop(value)}\n' for key,value in values.items()))
PY
  python3 ../../scripts/configure_flutter_android_signing.py android/app
  flutter clean
  flutter pub get
  flutter analyze --no-fatal-infos --no-fatal-warnings
  if [[ "$current" == customer ]]; then flutter test test/experience_test.dart test/runtime_config_test.dart; fi
  if [[ "$current" == merchant ]]; then flutter test test/order_search_test.dart; fi
  if [[ "$current" == driver ]]; then flutter test test/earnings_test.dart; fi
  flutter build "$kind" --release --build-number="$build_number" --dart-define="FIDA_API_BASE_URL=$api_base" --dart-define-from-file=firebase-defines.json
  if [[ "$kind" == apk ]]; then
    cp build/app/outputs/flutter-apk/app-release.apk "$root/dist/android/fida-$current-$build_number.apk"
  else
    cp build/app/outputs/bundle/release/app-release.aab "$root/dist/android/fida-$current-$build_number.aab"
  fi
done
unset FIDA_LOCAL_STORE_PASSWORD FIDA_LOCAL_KEY_PASSWORD FIDA_FIREBASE_CONFIG_JSON
printf 'Android output directory: %s/dist/android\n' "$root"
