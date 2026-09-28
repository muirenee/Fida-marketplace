#!/usr/bin/env python3
"""Configure an existing native Flutter project on an EAS worker; no credentials printed."""
import json
import os
import plistlib
from pathlib import Path


def configure(app: Path, simulator: bool, firebase_path: str = ''):
    role = app.name.removesuffix('-mobile')
    if role not in ('customer', 'merchant', 'driver'):
        raise ValueError('Unknown Fida app')
    bundle = f'com.fidalix.marketplace.{role}'
    ios = app / 'ios'
    info_path = ios / 'Runner/Info.plist'
    info = plistlib.loads(info_path.read_bytes())
    info.update({
        'CFBundleDisplayName': 'Fida Marketplace' if role == 'customer' else f'Fida {role.title()}',
        'ITSAppUsesNonExemptEncryption': False,
        'FirebaseAppDelegateProxyEnabled': True,
        'UIBackgroundModes': ([] if simulator else ['remote-notification']),
        'LSApplicationQueriesSchemes': ['tel', 'comgooglemaps', 'waze'],
    })
    if role in ('customer', 'driver'):
        info['NSLocationWhenInUseUsageDescription'] = (
            'Use your location to place the delivery pin and find nearby stores.'
            if role == 'customer' else 'Share your location with customers during active deliveries.'
        )
    if role == 'driver':
        info['NSLocationAlwaysAndWhenInUseUsageDescription'] = (
            'Fida shares your location while you are online for deliveries, including when '
            'the screen is locked or you are using navigation. Going offline stops tracking.'
        )
        info['UIBackgroundModes'].append('location')
    if role == 'merchant':
        info['NSPhotoLibraryUsageDescription'] = 'Choose product photos and store branding to upload.'
        info['NSCameraUsageDescription'] = 'Take product photos and store branding images.'
    info_path.write_bytes(plistlib.dumps(info))
    entitlements = {'keychain-access-groups': ['$(AppIdentifierPrefix)$(PRODUCT_BUNDLE_IDENTIFIER)']}
    if not simulator:
        entitlements['aps-environment'] = 'production'
    (ios / 'Runner/Runner.entitlements').write_bytes(plistlib.dumps(entitlements))
    project = ios / 'Runner.xcodeproj/project.pbxproj'
    text = project.read_text().replace('IPHONEOS_DEPLOYMENT_TARGET = 13.0;', 'IPHONEOS_DEPLOYMENT_TARGET = 15.0;')
    text = text.replace('INFOPLIST_FILE = Runner/Info.plist;',
                        'INFOPLIST_FILE = Runner/Info.plist;\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = Runner/Runner.entitlements;')
    # Idempotent when the worker reuses a checkout.
    import re
    text = re.sub(r'(CODE_SIGN_ENTITLEMENTS = Runner/Runner.entitlements;)(\s*CODE_SIGN_ENTITLEMENTS = Runner/Runner.entitlements;)+', r'\1', text)
    project.write_text(text)
    defines = {'FIDA_PUSH_ENABLED': not simulator, 'FIDA_FIREBASE_IOS_BUNDLE_ID': bundle}
    if not simulator:
        if not firebase_path:
            raise ValueError('Set FIDA_FIREBASE_IOS_PLIST to the matching iOS Firebase file in EAS.')
        firebase = plistlib.loads(Path(firebase_path).read_bytes())
        if firebase.get('BUNDLE_ID') != bundle:
            raise ValueError('Firebase iOS bundle identifier does not match this app')
        if ':ios:' not in str(firebase.get('GOOGLE_APP_ID', '')):
            raise ValueError('An iOS Firebase app registration is required; Android IDs cannot be reused')
        for source, target in {
            'API_KEY': 'FIDA_FIREBASE_API_KEY', 'GOOGLE_APP_ID': 'FIDA_FIREBASE_APP_ID',
            'GCM_SENDER_ID': 'FIDA_FIREBASE_SENDER_ID', 'PROJECT_ID': 'FIDA_FIREBASE_PROJECT_ID',
        }.items():
            if not firebase.get(source):
                raise ValueError(f'Missing {source} in Firebase iOS configuration')
            defines[target] = str(firebase[source])
    (app / 'firebase-defines.json').write_text(json.dumps(defines))
    return defines


if __name__ == '__main__':
    if os.environ.get('EAS_BUILD') != 'true' or os.environ.get('EAS_BUILD_PLATFORM') != 'ios':
        raise SystemExit('This entry point runs only on the EAS iOS cloud worker.')
    configure(Path.cwd(), os.environ.get('FIDA_IOS_SIMULATOR') == '1', os.environ.get('FIDA_FIREBASE_IOS_PLIST', ''))
