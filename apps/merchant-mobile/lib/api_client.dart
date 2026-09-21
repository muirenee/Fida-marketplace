import 'package:fida_mobile_common/fida_mobile_common.dart';

import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class MerchantApiException implements Exception {
  MerchantApiException(this.message);
  final String message;

  @override
  String toString() => message;
}

class MerchantApiClient {
  final push = FidaPush();
  MerchantApiClient();

  static const bootstrapUrl = String.fromEnvironment(
    'FIDA_API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3001',
  );
  static final endpoints = FidaEndpoints(bootstrapUrl);
  static String get baseUrl => endpoints.value.apiBaseUrl;
  Future<void> refreshConfiguration({bool force = false}) => endpoints.refresh(
    force: force,
    fetch: (uri) async {
      final response = await _client.get(uri).timeout(const Duration(seconds: 4));
      if (response.statusCode != 200) throw const FormatException('Configuration unavailable');
      return jsonDecode(response.body);
    },
    readCache: () => _storage.read(key: 'fida_runtime_endpoints'),
    writeCache: (data) => _storage.write(key: 'fida_runtime_endpoints', value: data),
  );

  static const _accessKey = 'fida_merchant_access';
  static const _refreshKey = 'fida_merchant_refresh';

  final _client = http.Client();
  final _storage = const FlutterSecureStorage();
  String? _access;
  String? _refresh;

  Uri _uri(String path, [Map<String, String>? query]) {
    final root = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
    return Uri.parse('$root$path').replace(queryParameters: query);
  }

  dynamic _json(http.Response response) =>
      response.body.isEmpty ? null : jsonDecode(response.body);

  MerchantApiException _error(http.Response response) {
    try {
      final data = _json(response);
      if (data is Map) {
        return MerchantApiException(
          (data['message'] ?? data['error'] ?? 'Request failed').toString(),
        );
      }
    } catch (_) {}
    return MerchantApiException('Request failed (${response.statusCode})');
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
    String? tenantId,
    Map<String, String>? query,
    bool authenticated = true,
    bool retry = true,
  }) async {
    await refreshConfiguration();
    final request = http.Request(method, _uri(path, query));
    request.headers['accept'] = 'application/json';
    request.headers['content-type'] = 'application/json';
    if (authenticated && _access != null)
      request.headers['authorization'] = 'Bearer $_access';
    if (tenantId != null) request.headers['x-tenant-id'] = tenantId;
    if (body != null || !['GET', 'HEAD'].contains(method)) {
      request.body = jsonEncode(body ?? <String, dynamic>{});
    } else {
      request.headers.remove('content-type');
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
        tenantId: tenantId,
        query: query,
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
    if (_refresh == null) return false;
    final response = await _send(
      'POST',
      '/v1/auth/refresh',
      authenticated: false,
      retry: false,
      body: {'refreshToken': _refresh},
    );
    if (response.statusCode != 200) {
      await clear();
      return false;
    }
    await _save(_json(response) as Map);
    return true;
  }

  Future<Map<String, dynamic>?> me() async {
    final response = await _send('GET', '/v1/auth/me');
    if (response.statusCode != 200) return null;
    final data = _json(response) as Map;
    return (data['user'] as Map).cast<String, dynamic>();
  }

  Future<List<Map<String, dynamic>>> tenants() async {
    final response = await _send('GET', '/v1/tenants');
    if (response.statusCode != 200) throw _error(response);
    return (_json(response) as List)
        .map((row) => (row as Map).cast<String, dynamic>())
        .toList();
  }

  Future<Map<String, dynamic>> createTenant({
    required String name,
    required String merchantType,
    required String branchName,
    String? city,
    String? addressLine,
    String currency = 'RWF',
    String timezone = 'Africa/Kigali',
  }) async {
    final response = await _send(
      'POST',
      '/v1/tenants',
      body: {
        'name': name,
        'merchantType': merchantType,
        'branchName': branchName,
        if (city != null && city.trim().isNotEmpty) 'city': city.trim(),
        if (addressLine != null && addressLine.trim().isNotEmpty)
          'addressLine': addressLine.trim(),
        'currency': currency,
        'timezone': timezone,
      },
    );
    if (response.statusCode != 201) throw _error(response);
    final data = (_json(response) as Map).cast<String, dynamic>();
    return (data['tenant'] as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> context(String tenantId) async {
    final response = await _send(
      'GET',
      '/v1/merchant/context',
      tenantId: tenantId,
    );
    if (response.statusCode != 200) throw _error(response);
    return (_json(response) as Map).cast<String, dynamic>();
  }

  Future<List<Map<String, dynamic>>> fulfillment(String tenantId) async {
    final response = await _send(
      'GET',
      '/v1/merchant/fulfillment',
      tenantId: tenantId,
    );
    if (response.statusCode != 200) throw _error(response);
    return (_json(response) as List)
        .map((row) => (row as Map).cast<String, dynamic>())
        .toList();
  }

  Future<Map<String, dynamic>> updateBranchFulfillment(
    String tenantId,
    String branchId, {
    bool? pickupEnabled,
    bool? deliveryEnabled,
    String? logisticsMode,
    double? latitude,
    double? longitude,
  }) async {
    final response = await _send(
      'PATCH',
      '/v1/merchant/branches/$branchId/fulfillment',
      tenantId: tenantId,
      body: {
        if (pickupEnabled != null) 'pickupEnabled': pickupEnabled,
        if (deliveryEnabled != null) 'deliveryEnabled': deliveryEnabled,
        if (logisticsMode != null) 'logisticsMode': logisticsMode,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
      },
    );
    if (response.statusCode != 200) throw _error(response);
    return (_json(response) as Map).cast<String, dynamic>();
  }

  Future<List<Map<String, dynamic>>> replaceDeliveryZones(
    String tenantId,
    String branchId,
    List<Map<String, dynamic>> zones,
  ) async {
    final response = await _send(
      'PUT',
      '/v1/merchant/branches/$branchId/delivery-zones',
      tenantId: tenantId,
      body: {'zones': zones},
    );
    if (response.statusCode != 200) throw _error(response);
    return (_json(response) as List)
        .map((row) => (row as Map).cast<String, dynamic>())
        .toList();
  }

  Future<List<Map<String, dynamic>>> drivers(String tenantId) async {
    final response = await _send(
      'GET',
      '/v1/merchant/drivers',
      tenantId: tenantId,
    );
    if (response.statusCode != 200) throw _error(response);
    return (_json(response) as List)
        .map((row) => (row as Map).cast<String, dynamic>())
        .toList();
  }

  Future<Map<String, dynamic>> enrollDriver(
    String tenantId, {
    required String emailOrPhone,
    String? branchId,
  }) async {
    final response = await _send(
      'POST',
      '/v1/merchant/drivers',
      tenantId: tenantId,
      body: {
        'emailOrPhone': emailOrPhone.trim(),
        if (branchId != null && branchId.isNotEmpty) 'branchId': branchId,
      },
    );
    if (response.statusCode != 200 && response.statusCode != 201)
      throw _error(response);
    return (_json(response) as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> updateDriver(
    String tenantId,
    String driverId, {
    bool? isActive,
    String? branchId,
    bool clearBranch = false,
  }) async {
    final response = await _send(
      'PATCH',
      '/v1/merchant/drivers/$driverId',
      tenantId: tenantId,
      body: {
        if (isActive != null) 'isActive': isActive,
        if (clearBranch)
          'branchId': null
        else if (branchId != null)
          'branchId': branchId,
      },
    );
    if (response.statusCode != 200) throw _error(response);
    return (_json(response) as Map).cast<String, dynamic>();
  }

  Future<List<Map<String, dynamic>>> orders(
    String tenantId, {
    String? status,
    String? search,
  }) async {
    final response = await _send(
      'GET',
      '/v1/merchant/orders',
      tenantId: tenantId,
      query: {if (status != null) 'status': status, if (search != null && search.trim().isNotEmpty) 'q': search.trim()},
    );
    if (response.statusCode != 200) throw _error(response);
    return (_json(response) as List)
        .map((row) => (row as Map).cast<String, dynamic>())
        .toList();
  }

  Future<Map<String, dynamic>> updateOrderStatus(
    String tenantId,
    String orderId,
    String status,
  ) async {
    final response = await _send(
      'PATCH',
      '/v1/merchant/orders/$orderId/status',
      tenantId: tenantId,
      body: {'status': status},
    );
    if (response.statusCode != 200) throw _error(response);
    return (_json(response) as Map).cast<String, dynamic>();
  }

  Future<List<Map<String, dynamic>>> categories(String tenantId) async {
    final response = await _send(
      'GET',
      '/v1/merchant/categories',
      tenantId: tenantId,
    );
    if (response.statusCode != 200) throw _error(response);
    return (_json(response) as List)
        .map((row) => (row as Map).cast<String, dynamic>())
        .toList();
  }

  Future<List<Map<String, dynamic>>> products(String tenantId) async {
    final response = await _send(
      'GET',
      '/v1/merchant/products',
      tenantId: tenantId,
    );
    if (response.statusCode != 200) throw _error(response);
    return (_json(response) as List)
        .map((row) => (row as Map).cast<String, dynamic>())
        .toList();
  }

  Future<Map<String, dynamic>> createCategory(
    String tenantId,
    String name,
  ) async {
    final response = await _send(
      'POST',
      '/v1/merchant/categories',
      tenantId: tenantId,
      body: {'name': name},
    );
    if (response.statusCode != 201) throw _error(response);
    return (_json(response) as Map).cast<String, dynamic>();
  }

  Future<Map<String, dynamic>> createProduct(
    String tenantId, {
    required String name,
    required double price,
    String? categoryId,
    String? description,
  }) async {
    final response = await _send(
      'POST',
      '/v1/merchant/products',
      tenantId: tenantId,
      body: {
        'name': name,
        'price': price,
        if (categoryId != null) 'categoryId': categoryId,
        if (description != null && description.isNotEmpty)
          'description': description,
      },
    );
    if (response.statusCode != 201) throw _error(response);
    return (_json(response) as Map).cast<String, dynamic>();
  }

  Future<void> logout() async {
    await push.stop();
    final refreshToken = _refresh;
    if (refreshToken != null) {
      try {
        await _send(
          'POST',
          '/v1/auth/logout',
          authenticated: false,
          body: {'refreshToken': refreshToken},
        );
      } catch (_) {}
    }
    await clear();
  }

  Future<dynamic> request(
    String method,
    String path, {
    Object? body,
    String? tenantId,
  }) async {
    final response = await _send(
      method,
      path,
      body: body,
      authenticated: true,
      tenantId: tenantId,
    );
    if (response.statusCode < 200 || response.statusCode >= 300)
      throw _error(response);
    return _json(response);
  }

  Future<void> startPush() => push.start('merchant', (method, token) async {
    await request(
      method,
      '/v1/notifications/devices',
      body: {'token': token, 'app': 'merchant'},
    );
  });

  Future<String> uploadBranding(List<int> bytes) async {
    await refreshConfiguration();
    if (bytes.isEmpty || bytes.length > 5 * 1024 * 1024) {
      throw MerchantApiException('Choose an image up to 5 MB.');
    }
    final String type;
    if (bytes.length >= 3 && bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255) {
      type = 'image/jpeg';
    } else if (bytes.length >= 8 && bytes[0] == 137 && bytes[1] == 80 && bytes[2] == 78 && bytes[3] == 71) {
      type = 'image/png';
    } else if (bytes.length >= 12 && ascii.decode(bytes.sublist(0, 4), allowInvalid: true) == 'RIFF' && ascii.decode(bytes.sublist(8, 12), allowInvalid: true) == 'WEBP') {
      type = 'image/webp';
    } else {
      throw MerchantApiException('Choose a JPEG, PNG or WebP image.');
    }
    for (var attempt = 0; attempt < 2; attempt++) {
      final response = await _client.post(_uri('/v1/merchant/branding'), headers: {
        'authorization': 'Bearer $_access', 'content-type': type, 'accept': 'application/json',
      }, body: bytes);
      if (response.statusCode == 201) return (_json(response) as Map)['url'].toString();
      if (response.statusCode != 401 || attempt != 0 || !await refresh()) throw _error(response);
    }
    throw MerchantApiException('Please sign in again.');
  }

  void close() => _client.close();
}
