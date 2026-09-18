#!/usr/bin/env python3
from pathlib import Path
import sys

app_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "android/app")
kts = app_dir / "build.gradle.kts"
groovy = app_dir / "build.gradle"

if kts.exists():
    path = kts
    text = path.read_text()
    if "import java.util.Properties" not in text:
        text = "import java.io.FileInputStream\nimport java.util.Properties\n\n" + text

    props = """val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}
"""
    if "val keystoreProperties = Properties()" not in text:
        text = text.replace("\nandroid {", "\n" + props + "\nandroid {", 1)

    signing = """    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"]?.toString()
            keyPassword = keystoreProperties["keyPassword"]?.toString()
            storeFile = keystoreProperties["storeFile"]?.toString()?.let { file(it) }
            storePassword = keystoreProperties["storePassword"]?.toString()
        }
    }

"""
    if 'create("release")' not in text:
        text = text.replace("    buildTypes {", signing + "    buildTypes {", 1)

    text = text.replace(
        'signingConfig = signingConfigs.getByName("debug")',
        'signingConfig = signingConfigs.getByName("release")',
    )
    path.write_text(text)
    print(f"Configured release signing in {path}")
elif groovy.exists():
    path = groovy
    text = path.read_text()

    props = """def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

"""
    if "def keystoreProperties = new Properties()" not in text:
        text = props + text

    signing = """    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }

"""
    if "signingConfigs {" not in text:
        text = text.replace("    buildTypes {", signing + "    buildTypes {", 1)

    text = text.replace("signingConfig signingConfigs.debug", "signingConfig signingConfigs.release")
    path.write_text(text)
    print(f"Configured release signing in {path}")
else:
    raise SystemExit(f"No Android app Gradle file found under {app_dir}")
