import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.code});

  final String message;
  final int? statusCode;
  final String? code;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({http.Client? client, FlutterSecureStorage? storage})
      : _client = client ?? http.Client(),
        _storage = storage ?? const FlutterSecureStorage();

  static const _accessKey = 'fida_access_token';
  static const _refreshKey = 'fida_refresh_token';
  static const baseUrl = String.fromEnvironment(
    'FIDA_API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3001',
  );

  final http.Client _client;
  final FlutterSecureStorage _storage;
  String? _accessToken;
  String? _refreshToken;

  bool get hasSession => _accessToken != null || _refreshToken != null;

  Uri _uri(String path, [Map<String, String>? query]) {
    final root = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    return Uri.parse('$root$path').replace(queryParameters: query);
  }

  Future<void> restoreSession() async {
    _accessToken = await _storage.read(key: _accessKey);
    _refreshToken = await _storage.read(key: _refreshKey);
  }

  Future<void> _saveTokens(Map<String, dynamic> json) async {
    final access = json['accessToken'] as String?;
    final refresh = json['refreshToken'] as String?;
    if (access != null) {
      _accessToken = access;
      await _storage.write(key: _accessKey, value: access);
    }
    if (refresh != null) {
      _refreshToken = refresh;
      await _storage.write(key: _refreshKey, value: refresh);
    }
  }

  Future<void> clearSession() async {
    _accessToken = null;
    _refreshToken = null;
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }

  Map<String, String> _headers({bool authenticated = false}) => {
        'accept': 'application/json',
        'content-type': 'application/json',
        if (authenticated && _accessToken != null) 'authorization': 'Bearer $_accessToken',
      };

  dynamic _decode(http.Response response) {
    if (response.body.isEmpty) return null;
    try {
      return jsonDecode(response.body);
    } catch (_) {
      return response.body;
    }
  }

  ApiException _error(http.Response response) {
    final decoded = _decode(response);
    if (decoded is Map<String, dynamic>) {
      return ApiException(
        (decoded['message'] ?? decoded['error'] ?? 'Request failed').toString(),
        statusCode: response.statusCode,
        code: decoded['error']?.toString(),
      );
    }
    return ApiException('Request failed (${response.statusCode})', statusCode: response.statusCode);
  }

  Future<http.Response> _send(
    String method,
    String path, {
    Object? body,
    bool authenticated = false,
    Map<String, String>? query,
    bool allowRefresh = true,
  }) async {
    final request = http.Request(method, _uri(path, query));
    request.headers.addAll(_headers(authenticated: authenticated));
    if (body != null) request.body = jsonEncode(body);

    final streamed = await _client.send(request);
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode == 401 && authenticated && allowRefresh && await refreshSession()) {
      return _send(method, path, body: body, authenticated: authenticated, query: query, allowRefresh: false);
    }
    return response;
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _send('POST', '/v1/auth/login', body: {'email': email, 'password': password});
    if (response.statusCode != 200) throw _error(response);
    final json = _decode(response) as Map<String, dynamic>;
    await _saveTokens(json);
    return (json['user'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> register({
    required String firstName,
    required String lastName,
    required String email,
    required String phone,
    required String password,
  }) async {
    final response = await _send(
      'POST',
      '/v1/auth/register',
      body: {'firstName': firstName, 'lastName': lastName, 'email': email, 'phone': phone, 'password': password},
    );
    if (response.statusCode != 201) throw _error(response);
    final json = _decode(response) as Map<String, dynamic>;
    await _saveTokens(json);
    return (json['user'] as Map).cast<String, dynamic>();
  }

  Future<bool> refreshSession() async {
    final token = _refreshToken;
    if (token == null) return false;
    try {
      final response = await _send('POST', '/v1/auth/refresh', body: {'refreshToken': token}, allowRefresh: false);
      if (response.statusCode != 200) {
        await clearSession();
        return false;
      }
      await _saveTokens(_decode(response) as Map<String, dynamic>);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<Map<String, dynamic>?> me() async {
    if (!hasSession) return null;
    final response = await _send('GET', '/v1/auth/me', authenticated: true);
    if (response.statusCode != 200) return null;
    final json = _decode(response) as Map<String, dynamic>;
    return (json['user'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> updatePhone(String phone) async {
    final response = await _send('PATCH', '/v1/auth/me', authenticated: true, body: {'phone': phone});
    if (response.statusCode != 200) throw _error(response);
    final json = _decode(response) as Map<String, dynamic>;
    return (json['user'] as Map).cast<String, dynamic>();
  }

  Future<void> logout() async {
    final refresh = _refreshToken;
    if (refresh != null) {
      try {
        await _send('POST', '/v1/auth/logout', body: {'refreshToken': refresh});
      } catch (_) {}
    }
    await clearSession();
  }

  Future<List<Map<String, dynamic>>> merchants({String? city, String? type}) async {
    final response = await _send(
      'GET',
      '/v1/marketplace/merchants',
      query: {
        if (city != null && city.trim().isNotEmpty) 'city': city.trim(),
        if (type != null && type.isNotEmpty) 'type': type,
      },
    );
    if (response.statusCode != 200) throw _error(response);
    return (_decode(response) as List).map((item) => (item as Map).cast<String, dynamic>()).toList();
  }

  Future<Map<String, dynamic>> merchant(String slug) async {
    final response = await _send('GET', '/v1/marketplace/merchants/$slug');
    if (response.statusCode != 200) throw _error(response);
    return (_decode(response) as Map).cast<String, dynamic>();
  }

  Future<List<Map<String, dynamic>>> addresses() async {
    final response = await _send('GET', '/v1/customer/addresses', authenticated: true);
    if (response.statusCode != 200) throw _error(response);
    return (_decode(response) as List).map((item) => (item as Map).cast<String, dynamic>()).toList();
  }

  Future<Map<String, dynamic>> addAddress({
    required String addressLine,
    String? label,
    String? city,
    String? instructions,
    double? latitude,
    double? longitude,
    bool isDefault = false,
  }) async {
    final response = await _send(
      'POST',
      '/v1/customer/addresses',
      authenticated: true,
      body: {
        'addressLine': addressLine,
        if (label != null) 'label': label,
        if (city != null) 'city': city,
        if (instructions != null) 'instructions': instructions,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
        'isDefault': isDefault,
      },
    );
    if (response.statusCode != 201) throw _error(response);
    return (_decode(response) as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> deliveryQuote({required String branchId, required String addressId}) async {
    final response = await _send(
      'GET',
      '/v1/customer/delivery-quote',
      authenticated: true,
      query: {'branchId': branchId, 'addressId': addressId},
    );
    if (response.statusCode != 200) throw _error(response);
    return (_decode(response) as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> deliveryQuoteForLocation({
    required String branchId,
    required double latitude,
    required double longitude,
  }) async {
    final response = await _send(
      'GET',
      '/v1/customer/delivery-quote/location',
      authenticated: true,
      query: {
        'branchId': branchId,
        'latitude': latitude.toString(),
        'longitude': longitude.toString(),
      },
    );
    if (response.statusCode != 200) throw _error(response);
    return (_decode(response) as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> validatePromo({
    required String tenantId,
    required String code,
    required double subtotal,
  }) async {
    final response = await _send(
      'POST',
      '/v1/customer/promotions/validate',
      authenticated: true,
      body: {'tenantId': tenantId, 'code': code.trim(), 'subtotal': subtotal},
    );
    if (response.statusCode != 200) throw _error(response);
    return (_decode(response) as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> createOrder({
    required String tenantId,
    required String branchId,
    required List<Map<String, dynamic>> items,
    required String paymentMethod,
    required String fulfillmentType,
    String? addressId,
    String? deliveryAddress,
    String? deliveryInstructions,
    String? promoCode,
  }) async {
    final response = await _send(
      'POST',
      '/v1/customer/orders',
      authenticated: true,
      body: {
        'tenantId': tenantId,
        'branchId': branchId,
        'items': items,
        'paymentMethod': paymentMethod,
        'fulfillmentType': fulfillmentType,
        if (addressId != null) 'addressId': addressId,
        if (deliveryAddress != null) 'deliveryAddress': deliveryAddress,
        if (deliveryInstructions != null) 'deliveryInstructions': deliveryInstructions,
        if (promoCode != null && promoCode.trim().isNotEmpty) 'promoCode': promoCode.trim(),
      },
    );
    if (response.statusCode != 201) throw _error(response);
    return (_decode(response) as Map).cast<String, dynamic>();
  }

  Future<List<Map<String, dynamic>>> orders() async {
    final response = await _send('GET', '/v1/customer/orders', authenticated: true);
    if (response.statusCode != 200) throw _error(response);
    return (_decode(response) as List).map((item) => (item as Map).cast<String, dynamic>()).toList();
  }

  Future<Map<String, dynamic>> order(String id) async {
    final response = await _send('GET', '/v1/customer/orders/$id', authenticated: true);
    if (response.statusCode != 200) throw _error(response);
    return (_decode(response) as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> orderTracking(String id) async {
    final response = await _send('GET', '/v1/customer/orders/$id/tracking', authenticated: true);
    if (response.statusCode != 200) throw _error(response);
    return (_decode(response) as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> orderReceipt(String id) async {
    final response = await _send('GET', '/v1/customer/orders/$id/receipt', authenticated: true);
    if (response.statusCode != 200) throw _error(response);
    return (_decode(response) as Map).cast<String, dynamic>();
  }

  Future<void> cancelOrder(String id) async {
    final response = await _send(
      'POST',
      '/v1/customer/orders/$id/cancel',
      authenticated: true,
      body: const <String, dynamic>{},
    );
    if (response.statusCode != 200) throw _error(response);
  }

  void close() => _client.close();
}
