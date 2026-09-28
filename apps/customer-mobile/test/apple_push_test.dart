import 'package:flutter_test/flutter_test.dart';
import 'package:fida_mobile_common/apple_push.dart';

void main() {
  test('waits for APNs before returning ready', () async {
    var calls = 0;
    expect(await waitForApplePushToken(
      readToken: () async => ++calls == 3 ? 'apns' : null,
      isActive: () => true,
      delay: (_) async {},
    ), isTrue);
    expect(calls, 3);
  });
  test('sign out while waiting cannot register a late token', () async {
    var active = true;
    expect(await waitForApplePushToken(
      readToken: () async { active = false; return 'apns'; },
      isActive: () => active,
      delay: (_) async {},
    ), isFalse);
  });
  test('missing APNs token is bounded and remains retryable', () async {
    var calls = 0;
    expect(await waitForApplePushToken(
      readToken: () async { calls++; return null; },
      isActive: () => true,
      attempts: 3,
      delay: (_) async {},
    ), isFalse);
    expect(calls, 3);
  });
}
