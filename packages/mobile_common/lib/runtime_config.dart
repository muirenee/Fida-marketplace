import 'dart:convert';
import 'package:flutter/foundation.dart';

class EndpointSnapshot {
  const EndpointSnapshot(this.apiBaseUrl, this.publicBaseUrl, this.legacyOrigins);
  final String apiBaseUrl, publicBaseUrl;
  final List<String> legacyOrigins;
}

class FidaEndpoints extends ValueNotifier<EndpointSnapshot> {
  FidaEndpoints(this.bootstrap) : super(EndpointSnapshot(bootstrap, bootstrap, [])) {
    _instances.add(this);
  }
  final String bootstrap;
  static final changes = ValueNotifier<int>(0);
  static final _instances = <FidaEndpoints>[];
  DateTime _nextCheck = DateTime.fromMillisecondsSinceEpoch(0);
  Future<void>? _pending;
  bool _restored = false;
  String _origin(String value) => Uri.parse(value).origin;
  String _base(dynamic raw) {
    final uri = Uri.parse(raw as String);
    if (uri.scheme != 'https' || uri.host.isEmpty || uri.userInfo.isNotEmpty ||
        uri.hasQuery || uri.hasFragment || !['', '/'].contains(uri.path)) {
      throw const FormatException('Invalid platform base URL');
    }
    return uri.origin;
  }
  void apply(Map<String, dynamic> config) {
    if (config['schemaVersion'] != 1 || config['apiBaseUrl'] == null) return;
    final api = _base(config['apiBaseUrl']);
    final public = _base(config['publicBaseUrl']);
    final legacy = <String>{_origin(bootstrap), _origin(value.apiBaseUrl),
      ...value.legacyOrigins,
      for (final origin in (config['legacyOrigins'] as List? ?? [])) _base(origin)}.toList();
    value = EndpointSnapshot(api, public, legacy);
    changes.value++;
  }
  Future<void> refresh({
    required Future<dynamic> Function(Uri) fetch,
    Future<String?> Function()? readCache,
    Future<void> Function(String)? writeCache,
    bool force = false,
  }) async {
    if (_pending != null) return _pending!;
    if (!force && DateTime.now().isBefore(_nextCheck)) return;
    _pending = _refresh(fetch, readCache, writeCache);
    try { await _pending; } finally { _pending = null; }
  }
  Future<void> _refresh(Future<dynamic> Function(Uri) fetch,
      Future<String?> Function()? readCache, Future<void> Function(String)? writeCache) async {
    if (!_restored) {
      _restored = true;
      try { final cached = await readCache?.call(); if (cached != null) apply(Map<String,dynamic>.from(jsonDecode(cached))); } catch (_) {}
    }
    _nextCheck = DateTime.now().add(const Duration(seconds: 30));
    for (final base in {value.apiBaseUrl, bootstrap}) {
      try {
        final config = Map<String,dynamic>.from(await fetch(Uri.parse(base).resolve('/v1/config')));
        if (config['schemaVersion'] != 1) continue;
        apply(config);
        try { await writeCache?.call(jsonEncode(config)); } catch (_) {}
        return;
      } catch (_) {}
    }
  }
  Uri apiUri(String path) {
    if (!path.startsWith('/') || path.startsWith('//')) throw ArgumentError('Relative API path required');
    return Uri.parse(value.apiBaseUrl).resolve(path);
  }
  Uri get merchantUri => Uri.parse(value.publicBaseUrl).resolve('/merchant');
  static String mediaUri(String baseUrl, String source) {
    final uri = Uri.parse(source);
    final config = _instances.where((e) => e.bootstrap == baseUrl ||
      e.value.apiBaseUrl == baseUrl || e.value.legacyOrigins.contains(Uri.parse(baseUrl).origin)).firstOrNull;
    if (config == null) return Uri.parse(baseUrl).resolve(source).toString();
    final owned = uri.path.startsWith('/v1/media/') &&
      (!uri.hasAuthority || config.value.legacyOrigins.contains(uri.origin) || uri.origin == Uri.parse(config.value.apiBaseUrl).origin);
    return owned ? Uri.parse(config.value.apiBaseUrl).resolveUri(Uri(path: uri.path, query: uri.hasQuery ? uri.query : null)).toString()
      : Uri.parse(baseUrl).resolve(source).toString();
  }
  @override
  void dispose() { _instances.remove(this); super.dispose(); }
}
