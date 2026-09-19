import 'package:fida_mobile_common/fida_mobile_common.dart';

import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class DriverApiException implements Exception {
  DriverApiException(this.message);
  final String message;

  @override
  String toString() => message;
}

class DriverApiClient {
  final push = FidaPush();
  DriverApiClient();

  static const baseUrl = String.fromEnvironment(
    'FIDA_API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3001',
  );
  static const _accessKey = 'fida_driver_access';
  static const _refreshKey = 'fida_driver_refresh';

  final _client = http.Client();
  final _storage = const FlutterSecureStorage();
  String? _access;
  String? _refresh;

  Uri _uri(String path) {
    final root = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
    return Uri.parse('$root$path');
  }

  dynamic _json(http.Response response) =>
      response.body.isEmpty ? null : jsonDecode(response.body);

  DriverApiException _error(http.Response response) {
    try {
      final data = _json(response);
      if (data is Map) {
        return DriverApiException(
          (data['message'] ?? data['error'] ?? 'Request failed').toString(),
        );
      }
    } catch (_) {}
    return DriverApiException('Request failed (${response.statusCode})');
  }

  Future<void> restore() async {
    _access = await _storage.read(key: _accessKey);
    _refresh = await _storage.read(key: _refreshKey);
  }

  Future<void> _save(Map data) async {
    final access = data['accessToken'] as String?;
    final refresh = data['refreshToken'] as String?;
    if (access != null) {
      _access = access;
      await _storage.write(key: _accessKey, value: access);
    }
    if (refresh != null) {
      _refresh = refresh;
      await _storage.write(key: _refreshKey, value: refresh);
    }
  }

  Future<void> clear() async {
    _access = null;
    _refresh = null;
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }

  Future<http.Response> _send(
    String method,
    String path, {
    Object? body,
    bool authenticated = true,
    bool retry = true,
  }) async {
    final request = http.Request(method, _uri(path));
    request.headers['accept'] = 'application/json';
    if (authenticated && _access != null)
      request.headers['authorization'] = 'Bearer $_access';
    if (body != null) {
      request.headers['content-type'] = 'application/json';
      request.body = jsonEncode(body);
    }

    final response = await http.Response.fromStream(
      await _client.send(request),
    );
    if (response.statusCode == 401 &&
        authenticated &&
        retry &&
        await refresh()) {
      return _send(
        method,
        path,
        body: body,
        authenticated: authenticated,
        retry: false,
      );
    }
    return response;
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _send(
      'POST',
      '/v1/auth/login',
      authenticated: false,
      body: {'email': email, 'password': password},
    );
    if (response.statusCode != 200) throw _error(response);
    final data = (_json(response) as Map).cast<String, dynamic>();
    await _save(data);
    return (data['user'] as Map).cast<String, dynamic>();
  }

  Future<bool>? _refreshing;
  Future<bool> refresh() =>
      _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);

  Future<bool> _doRefresh() async {
    final token = _refresh;
    if (token == null) return false;
    final response = await _send(
      'POST',
      '/v1/auth/refresh',
      authenticated: false,
      retry: false,
      body: {'refreshToken': token},
    );
    if (response.statusCode != 200) {
      await clear();
      return false;
    }
    await _save(_json(response) as Map);
    return true;
  }

  Future<Map<String, dynamic>?> me() async {
    if (_access == null && _refresh == null) return null;
    final response = await _send('GET', '/v1/auth/me');
    if (response.statusCode != 200) return null;
    final data = _json(response) as Map;
    return (data['user'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> profile() async {
    final response = await _send('GET', '/v1/driver/profile');
    if (response.statusCode != 200) throw _error(response);
    return (_json(response) as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> setAvailability({
    required bool isOnline,
    required bool isAvailable,
  }) async {
    final response = await _send(
      'PATCH',
      '/v1/driver/availability',
      body: {'isOnline': isOnline, 'isAvailable': isAvailable},
    );
    if (response.statusCode != 200) throw _error(response);
    return (_json(response) as Map).cast<String, dynamic>();
  }

  Future<void> updateLocation(double latitude, double longitude) async {
    final response = await _send(
      'PATCH',
      '/v1/driver/location',
      body: {'latitude': latitude, 'longitude': longitude},
    );
    if (response.statusCode != 200) throw _error(response);
  }

  Future<List<Map<String, dynamic>>> availableDeliveries() async {
    final response = await _send('GET', '/v1/driver/deliveries/available');
    if (response.statusCode != 200) throw _error(response);
    return (_json(response) as List)
        .map((row) => (row as Map).cast<String, dynamic>())
        .toList();
  }

  Future<Map<String, dynamic>?> currentDelivery() async {
    final response = await _send('GET', '/v1/driver/deliveries/current');
    if (response.statusCode != 200) throw _error(response);
    final data = _json(response);
    if (data == null) return null;
    return (data as Map).cast<String, dynamic>();
  }

  Future<List<Map<String, dynamic>>> activeDeliveries() async {
    final response = await _send('GET', '/v1/driver/deliveries/active');
    if (response.statusCode != 200) throw _error(response);
    return (_json(response) as List)
        .map((row) => (row as Map).cast<String, dynamic>())
        .toList();
  }

  Future<Map<String, dynamic>> claim(String deliveryId) async {
    final response = await _send(
      'POST',
      '/v1/driver/deliveries/$deliveryId/claim',
    );
    if (response.statusCode != 200) throw _error(response);
    return (_json(response) as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> updateDeliveryStatus(
    String deliveryId,
    String status,
  ) async {
    final response = await _send(
      'PATCH',
      '/v1/driver/deliveries/$deliveryId/status',
      body: {'status': status},
    );
    if (response.statusCode != 200) throw _error(response);
    return (_json(response) as Map).cast<String, dynamic>();
  }

  Future<void> logout() async {
    await push.stop();
    final token = _refresh;
    if (token != null) {
      try {
        await _send(
          'POST',
          '/v1/auth/logout',
          authenticated: false,
          body: {'refreshToken': token},
        );
      } catch (_) {}
    }
    await clear();
  }

  Future<dynamic> request(String method, String path, {Object? body}) async {
    final response = await _send(method, path, body: body, authenticated: true);
    if (response.statusCode < 200 || response.statusCode >= 300)
      throw _error(response);
    return _json(response);
  }

  Future<void> startPush() => push.start('driver', (method, token) async {
    await request(
      method,
      '/v1/notifications/devices',
      body: {'token': token, 'app': 'driver'},
    );
  });

  void close() => _client.close();
}
