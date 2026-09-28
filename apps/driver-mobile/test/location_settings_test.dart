import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import '../lib/location_settings.dart';

void main() {
  test('iOS delivery tracking continues with a visible background indicator', () {
    final settings = deliveryLocationSettings(TargetPlatform.iOS) as AppleSettings;
    expect(settings.allowBackgroundLocationUpdates, isTrue);
    expect(settings.pauseLocationUpdatesAutomatically, isFalse);
    expect(settings.showBackgroundLocationIndicator, isTrue);
    expect(settings.activityType, ActivityType.automotiveNavigation);
  });
  test('Android retains foreground service and wake lock', () {
    final settings = deliveryLocationSettings(TargetPlatform.android) as AndroidSettings;
    expect(settings.foregroundNotificationConfig?.enableWakeLock, isTrue);
    expect(settings.intervalDuration, const Duration(seconds: 10));
  });
}
