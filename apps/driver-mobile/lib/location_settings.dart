import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

LocationSettings deliveryLocationSettings(TargetPlatform platform) {
  if (platform == TargetPlatform.iOS || platform == TargetPlatform.macOS) {
    return AppleSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 10,
      activityType: ActivityType.automotiveNavigation,
      pauseLocationUpdatesAutomatically: false,
      showBackgroundLocationIndicator: true,
      allowBackgroundLocationUpdates: true,
    );
  }
  if (platform == TargetPlatform.android) {
    return AndroidSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 10,
      intervalDuration: const Duration(seconds: 10),
      foregroundNotificationConfig: const ForegroundNotificationConfig(
        notificationTitle: 'Fida delivery is active',
        notificationText: 'Sharing your location while you are online.',
        enableWakeLock: true,
      ),
    );
  }
  return const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 10);
}
