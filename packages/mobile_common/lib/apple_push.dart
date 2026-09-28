/// FCM on Apple platforms may be called only after APNs registration completes.
/// Cancellation prevents a late token from registering after sign-out.
Future<bool> waitForApplePushToken({
  required Future<String?> Function() readToken,
  required bool Function() isActive,
  Future<void> Function(Duration)? delay,
  int attempts = 10,
}) async {
  final pause = delay ?? (duration) => Future<void>.delayed(duration);
  for (var attempt = 0; attempt < attempts && isActive(); attempt++) {
    if ((await readToken())?.isNotEmpty == true) return isActive();
    if (attempt + 1 < attempts && isActive()) {
      await pause(const Duration(seconds: 1));
    }
  }
  return false;
}
