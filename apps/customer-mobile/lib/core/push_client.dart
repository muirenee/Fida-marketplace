import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

class PushClient {
  static const _apiKey = String.fromEnvironment('FIDA_FIREBASE_API_KEY');
  static const _appId = String.fromEnvironment('FIDA_FIREBASE_APP_ID');
  static const _messagingSenderId = String.fromEnvironment('FIDA_FIREBASE_MESSAGING_SENDER_ID');
  static const _projectId = String.fromEnvironment('FIDA_FIREBASE_PROJECT_ID');

  static StreamSubscription<String>? _tokenSubscription;
  static String? _lastToken;
  static Future<bool>? _initializing;

  static bool get configured =>
      _apiKey.isNotEmpty && _appId.isNotEmpty && _messagingSenderId.isNotEmpty && _projectId.isNotEmpty;

  static Future<bool> _ensureInitialized() {
    return _initializing ??= _initialize();
  }

  static Future<bool> _initialize() async {
    if (!configured) return false;
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(
          options: const FirebaseOptions(
            apiKey: _apiKey,
            appId: _appId,
            messagingSenderId: _messagingSenderId,
            projectId: _projectId,
          ),
        );
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<void> sync(Future<void> Function(String token) registerToken) async {
    if (!await _ensureInitialized()) return;
    try {
      await FirebaseMessaging.instance.requestPermission(alert: true, badge: true, sound: true);
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null && token.isNotEmpty) {
        _lastToken = token;
        await registerToken(token);
      }
      _tokenSubscription ??= FirebaseMessaging.instance.onTokenRefresh.listen((token) {
        _lastToken = token;
        unawaited(registerToken(token));
      });
    } catch (_) {
      // Push setup must never block sign-in or ordering.
    }
  }

  static Future<void> unregister(Future<void> Function(String token) unregisterToken) async {
    if (!await _ensureInitialized()) return;
    try {
      final token = _lastToken ?? await FirebaseMessaging.instance.getToken();
      if (token != null && token.isNotEmpty) await unregisterToken(token);
    } catch (_) {
      // Logout must still succeed if Firebase is temporarily unavailable.
    }
    await _tokenSubscription?.cancel();
    _tokenSubscription = null;
    _lastToken = null;
  }
}
