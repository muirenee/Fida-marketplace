import 'package:flutter/foundation.dart';

import 'api_client.dart';

class SessionController extends ChangeNotifier {
  SessionController(this.api);

  final ApiClient api;
  Map<String, dynamic>? user;
  bool initializing = true;
  bool busy = false;
  String? error;

  bool get isAuthenticated => user != null;

  Future<void> initialize() async {
    try {
      await api.restoreSession();
      user = await api.me();
      if (user == null && api.hasSession) await api.clearSession();
    } catch (_) {
      user = null;
    } finally {
      initializing = false;
      notifyListeners();
    }
  }

  Future<bool> login(String email, String password) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      user = await api.login(email.trim(), password);
      return true;
    } on ApiException catch (e) {
      error = e.message;
      return false;
    } catch (_) {
      error = 'Unable to connect to Fida Marketplace.';
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> register({
    required String firstName,
    required String lastName,
    required String email,
    required String password,
  }) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      user = await api.register(
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password: password,
      );
      return true;
    } on ApiException catch (e) {
      error = e.message;
      return false;
    } catch (_) {
      error = 'Unable to connect to Fida Marketplace.';
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    busy = true;
    notifyListeners();
    await api.logout();
    user = null;
    busy = false;
    notifyListeners();
  }
}
