# Android release signing

Fida Marketplace mobile APKs must use one persistent Android signing key so sideloaded updates can be installed over earlier signed releases.

The same Fida release key can sign Customer, Merchant and Driver because they have different application IDs.

## Repository secrets

Add these GitHub Actions repository secrets:

- `FIDA_ANDROID_KEYSTORE_BASE64`
- `FIDA_ANDROID_KEYSTORE_PASSWORD`
- `FIDA_ANDROID_KEY_ALIAS`
- `FIDA_ANDROID_KEY_PASSWORD`

The workflows build debug APKs for pull requests. On pushes to `main`, when all four secrets exist, they build signed release APKs.

## Generate the permanent key once

Run this on a trusted machine and keep the JKS file backed up securely:

```bash
keytool -genkeypair -v \
  -keystore fida-marketplace-release.jks \
  -alias fida-marketplace \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000
```

Use a strong password that you will retain permanently.

Encode the JKS for the GitHub secret:

```bash
base64 -w0 fida-marketplace-release.jks
```

Set:

- `FIDA_ANDROID_KEYSTORE_BASE64` = the base64 output
- `FIDA_ANDROID_KEYSTORE_PASSWORD` = keystore password
- `FIDA_ANDROID_KEY_ALIAS` = `fida-marketplace`
- `FIDA_ANDROID_KEY_PASSWORD` = key password

Do not commit the JKS, passwords, or base64 value.

## Update behavior

The first APK signed by this permanent key may require one uninstall if the installed test APK used a different debug key. After that, future APKs produced with the same key and a higher build number install as normal updates.

The workflows assign a monotonically increasing release build number using the GitHub Actions run number.
