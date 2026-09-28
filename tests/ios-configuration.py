"""Offline iOS safety/configuration regression checks; no Apple or Expo account required."""
import importlib.util
import json
import plistlib
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('iosconfig', ROOT / 'scripts/eas/configure-ios.py')
config = importlib.util.module_from_spec(spec)
spec.loader.exec_module(config)


class IosConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def app(self, role):
        app = self.root / f'{role}-mobile'
        shutil.copytree(ROOT / f'apps/{role}-mobile/ios', app / 'ios')
        return app

    def test_unsigned_simulators_have_no_push_or_team_requirement(self):
        for role in ('customer', 'merchant', 'driver'):
            app = self.app(role)
            defines = config.configure(app, True)
            self.assertFalse(defines['FIDA_PUSH_ENABLED'])
            entitlements = plistlib.loads((app / 'ios/Runner/Runner.entitlements').read_bytes())
            self.assertNotIn('aps-environment', entitlements)
            info = plistlib.loads((app / 'ios/Runner/Info.plist').read_bytes())
            self.assertNotIn('remote-notification', info['UIBackgroundModes'])
            self.assertEqual('location' in info['UIBackgroundModes'], role == 'driver')
            self.assertEqual('NSLocationAlwaysAndWhenInUseUsageDescription' in info, role == 'driver')
            self.assertEqual('NSCameraUsageDescription' in info, role == 'merchant')
            text = (app / 'ios/Runner.xcodeproj/project.pbxproj').read_text()
            self.assertNotIn('DEVELOPMENT_TEAM =', text)
            config.configure(app, True)
            self.assertEqual(text, (app / 'ios/Runner.xcodeproj/project.pbxproj').read_text())

    def test_device_requires_matching_ios_firebase_registration(self):
        app = self.app('driver')
        with self.assertRaisesRegex(ValueError, 'FIDA_FIREBASE_IOS_PLIST'):
            config.configure(app, False)
        fixture = self.root / 'firebase.plist'
        value = {'BUNDLE_ID': 'com.fidalix.marketplace.customer', 'GOOGLE_APP_ID': '1:123:ios:test',
                 'API_KEY': 'test-key', 'GCM_SENDER_ID': '123', 'PROJECT_ID': 'test-project'}
        fixture.write_bytes(plistlib.dumps(value))
        with self.assertRaisesRegex(ValueError, 'bundle identifier'):
            config.configure(app, False, str(fixture))
        value['BUNDLE_ID'] = 'com.fidalix.marketplace.driver'
        value['GOOGLE_APP_ID'] = '1:123:android:test'
        fixture.write_bytes(plistlib.dumps(value))
        with self.assertRaisesRegex(ValueError, 'iOS Firebase'):
            config.configure(app, False, str(fixture))
        value['GOOGLE_APP_ID'] = '1:123:ios:test'
        fixture.write_bytes(plistlib.dumps(value))
        defines = config.configure(app, False, str(fixture))
        self.assertTrue(defines['FIDA_PUSH_ENABLED'])
        self.assertEqual(defines['FIDA_FIREBASE_APP_ID'], value['GOOGLE_APP_ID'])
        self.assertEqual(plistlib.loads((app / 'ios/Runner/Runner.entitlements').read_bytes())['aps-environment'], 'production')

    def test_profiles_are_native_custom_cloud_builds(self):
        for role in ('customer', 'merchant', 'driver'):
            app = ROOT / f'apps/{role}-mobile'
            profiles = json.loads((app / 'eas.json').read_text())['build']
            simulator = profiles['development-simulator']
            self.assertTrue(simulator['ios']['simulator'])
            self.assertTrue(simulator['ios']['withoutCredentials'])
            # Expo's development client cannot be linked into the Flutter runtime.
            self.assertFalse(simulator['developmentClient'])
            self.assertEqual(profiles['preview']['distribution'], 'internal')
            self.assertFalse(profiles['preview']['ios']['withoutCredentials'])
            for name in ('development-simulator', 'preview'):
                self.assertTrue((app / '.eas/build' / profiles[name]['ios']['config']).is_file())
            self.assertNotIn('--local', (ROOT / 'scripts/build-ios-cloud.sh').read_text())


if __name__ == '__main__':
    unittest.main()
