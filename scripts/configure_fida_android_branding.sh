#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-android/app}"
RES_DIR="${APP_DIR}/src/main/res"
MANIFEST="${APP_DIR}/src/main/AndroidManifest.xml"

mkdir -p \
  "${RES_DIR}/drawable" \
  "${RES_DIR}/values" \
  "${RES_DIR}/mipmap-anydpi" \
  "${RES_DIR}/mipmap-anydpi-v26"

# flutter create installs Flutter's default launcher artwork. Remove only that
# generated artwork and replace it with the previous Fida shopping-bag icon.
find "${RES_DIR}" -type f \( -name 'ic_launcher.png' -o -name 'ic_launcher.webp' -o -name 'ic_launcher_round.png' -o -name 'ic_launcher_round.webp' \) -delete

cat > "${RES_DIR}/values/fida_launcher_colors.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="fida_launcher_background">#FFFFFF</color>
</resources>
EOF

cat > "${RES_DIR}/drawable/fida_launcher_foreground.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#00865F"
        android:pathData="M27,27 H81 V81 H27 Z" />
    <path
        android:fillColor="#A8EF78"
        android:pathData="M40,49 H68 L66,73 H42 Z" />
    <path
        android:fillColor="@android:color/transparent"
        android:strokeColor="#FFFFFF"
        android:strokeWidth="4"
        android:strokeLineCap="round"
        android:pathData="M44,51 C44,40 49,35 54,35 C59,35 64,40 64,51" />
    <path
        android:fillColor="#00865F"
        android:pathData="M48,54 H61 V58 H53 V61 H60 V65 H53 V70 H48 Z" />
</vector>
EOF

cat > "${RES_DIR}/drawable/fida_launcher_legacy.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M0,0 H108 V108 H0 Z" />
    <path
        android:fillColor="#00865F"
        android:pathData="M27,27 H81 V81 H27 Z" />
    <path
        android:fillColor="#A8EF78"
        android:pathData="M40,49 H68 L66,73 H42 Z" />
    <path
        android:fillColor="@android:color/transparent"
        android:strokeColor="#FFFFFF"
        android:strokeWidth="4"
        android:strokeLineCap="round"
        android:pathData="M44,51 C44,40 49,35 54,35 C59,35 64,40 64,51" />
    <path
        android:fillColor="#00865F"
        android:pathData="M48,54 H61 V58 H53 V61 H60 V65 H53 V70 H48 Z" />
</vector>
EOF

cat > "${RES_DIR}/mipmap-anydpi/ic_launcher.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@drawable/fida_launcher_legacy"
    android:inset="0dp" />
EOF

cat > "${RES_DIR}/mipmap-anydpi/ic_launcher_round.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@drawable/fida_launcher_legacy"
    android:inset="0dp" />
EOF

cat > "${RES_DIR}/mipmap-anydpi-v26/ic_launcher.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/fida_launcher_background" />
    <foreground android:drawable="@drawable/fida_launcher_foreground" />
</adaptive-icon>
EOF

cat > "${RES_DIR}/mipmap-anydpi-v26/ic_launcher_round.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/fida_launcher_background" />
    <foreground android:drawable="@drawable/fida_launcher_foreground" />
</adaptive-icon>
EOF

# Keep the existing app label/UI untouched; only ensure Android can use the
# matching round launcher resource where supported.
python - "${MANIFEST}" <<'PY'
from pathlib import Path
import sys

manifest = Path(sys.argv[1])
text = manifest.read_text()
if 'android:roundIcon=' not in text:
    text = text.replace(
        'android:icon="@mipmap/ic_launcher"',
        'android:icon="@mipmap/ic_launcher"\n        android:roundIcon="@mipmap/ic_launcher_round"',
        1,
    )
manifest.write_text(text)
PY

echo "Applied previous Fida shopping-bag launcher icon."
