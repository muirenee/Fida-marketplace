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

# flutter create installs Flutter's default launcher artwork. Remove it so every
# generated Android scaffold uses Fida's own brand mark instead.
find "${RES_DIR}" -type f \( -name 'ic_launcher.png' -o -name 'ic_launcher.webp' -o -name 'ic_launcher_round.png' -o -name 'ic_launcher_round.webp' \) -delete

cat > "${RES_DIR}/values/fida_launcher_colors.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="fida_launcher_background">#0B0B0B</color>
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
        android:fillColor="#FFFFFF"
        android:pathData="M34,25 H75 V38 H49 V49 H70 V62 H49 V83 H34 Z" />
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
        android:fillColor="#0B0B0B"
        android:pathData="M24,8 H84 C92.8,8 100,15.2 100,24 V84 C100,92.8 92.8,100 84,100 H24 C15.2,100 8,92.8 8,84 V24 C8,15.2 15.2,8 24,8 Z" />
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M34,25 H75 V38 H49 V49 H70 V62 H49 V83 H34 Z" />
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

python - "${MANIFEST}" <<'PY'
from pathlib import Path
import sys

manifest = Path(sys.argv[1])
text = manifest.read_text()
text = text.replace('android:label="customer_mobile"', 'android:label="Fida Marketplace"')
if 'android:roundIcon=' not in text:
    text = text.replace(
        'android:icon="@mipmap/ic_launcher"',
        'android:icon="@mipmap/ic_launcher"\n        android:roundIcon="@mipmap/ic_launcher_round"',
        1,
    )
manifest.write_text(text)
PY

echo "Applied Fida Marketplace launcher icon and app label."
