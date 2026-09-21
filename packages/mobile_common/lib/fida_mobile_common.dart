export 'runtime_config.dart';
import 'runtime_config.dart';
export 'document_screen.dart';
export 'delivery_map.dart';
export 'food_ui.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

ThemeData fidaTheme() {
  final scheme =
      ColorScheme.fromSeed(
        seedColor: const Color(0xFF07855A),
        surface: Colors.white,
      ).copyWith(
        primary: const Color(0xFF07855A),
        secondary: const Color(0xFFED8E32),
        tertiary: const Color(0xFF7656C6),
      );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: Colors.white,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFFF3F3F3),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide.none,
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: const Color(0xFF111111),
        foregroundColor: Colors.white,
        minimumSize: const Size(48, 52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
    navigationBarTheme: const NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: Color(0xFFDDF3E2),
    ),
  );
}

class FidaHero extends StatelessWidget {
  const FidaHero({
    super.key,
    required this.title,
    required this.subtitle,
    this.icon = Icons.storefront_rounded,
  });
  final String title, subtitle;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(24),
    margin: const EdgeInsets.only(bottom: 18),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [Color(0xFF123C2A), Color(0xFF198C62)],
      ),
      borderRadius: BorderRadius.circular(24),
    ),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                subtitle,
                style: const TextStyle(color: Color(0xFFD9EFD2), height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Icon(icon, color: const Color(0xFFD2F3AA), size: 58),
      ],
    ),
  );
}

Future<void> openFidaLink(BuildContext context, Uri uri) async {
  try {
    if (await launchUrl(uri, mode: LaunchMode.externalApplication)) return;
  } catch (_) {}
  if (context.mounted)
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('No app could open this action.')),
    );
}

Future<void> callPhone(BuildContext context, String phone) async {
  final clean = phone.replaceAll(RegExp(r'[^+0-9]'), '');
  if (!RegExp(r'^\+?[0-9]{7,15}$').hasMatch(clean)) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('No valid phone number is available.')),
    );
    return;
  }
  await openFidaLink(context, Uri(scheme: 'tel', path: clean));
}

Uri destinationUri({
  Object? latitude,
  Object? longitude,
  String? address,
  bool navigate = false,
}) {
  final lat = double.tryParse('$latitude'), lon = double.tryParse('$longitude');
  final valid =
      lat != null &&
      lon != null &&
      lat.isFinite &&
      lon.isFinite &&
      lat.abs() <= 90 &&
      lon.abs() <= 180;
  final destination = valid ? '$lat,$lon' : (address ?? '').trim();
  return Uri.https(
    'www.google.com',
    navigate ? '/maps/dir/' : '/maps/search/',
    navigate
        ? {
            'api': '1',
            'destination': destination,
            'travelmode': 'driving',
            'dir_action': 'navigate',
          }
        : {'api': '1', 'query': destination},
  );
}

class DestinationActions extends StatelessWidget {
  const DestinationActions({
    super.key,
    this.latitude,
    this.longitude,
    required this.address,
    this.label = 'customer',
  });
  final Object? latitude, longitude;
  final String address, label;
  @override
  Widget build(BuildContext context) {
    final hasCoordinate =
        double.tryParse('$latitude') != null &&
        double.tryParse('$longitude') != null;
    final enabled = hasCoordinate || address.trim().isNotEmpty;
    return Wrap(
      spacing: 8,
      children: [
        OutlinedButton.icon(
          onPressed: !enabled
              ? null
              : () => openFidaLink(
                  context,
                  destinationUri(
                    latitude: latitude,
                    longitude: longitude,
                    address: address,
                  ),
                ),
          icon: const Icon(Icons.map_outlined),
          label: const Text('View map'),
        ),
        FilledButton.icon(
          onPressed: !enabled
              ? null
              : () => openFidaLink(
                  context,
                  destinationUri(
                    latitude: latitude,
                    longitude: longitude,
                    address: address,
                    navigate: true,
                  ),
                ),
          icon: const Icon(Icons.navigation_rounded),
          label: Text('Navigate to $label'),
        ),
      ],
    );
  }
}

class ProductPhoto extends StatelessWidget {
  const ProductPhoto({
    super.key,
    required this.url,
    required this.baseUrl,
    this.size = 90,
  });
  final String? url;
  final String baseUrl;
  final double size;
  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      color: const Color(0xFFFFEBD1),
      child: const Center(
        child: Icon(
          Icons.restaurant_rounded,
          color: Color(0xFFD48B34),
          size: 32,
        ),
      ),
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        width: size,
        height: size,
        child: url == null || url!.isEmpty
            ? placeholder
            : ValueListenableBuilder<int>(valueListenable:FidaEndpoints.changes,builder:(_,__,___)=>Image.network(
                FidaEndpoints.mediaUri(baseUrl, url!),
                fit: BoxFit.cover,
                errorBuilder: (_, e, s) => placeholder,
              )),
      ),
    );
  }
}

// Configuration is supplied at build time; missing Firebase never prevents login.
const _apiKey = String.fromEnvironment('FIDA_FIREBASE_API_KEY');
const _appId = String.fromEnvironment('FIDA_FIREBASE_APP_ID');
const _senderId = String.fromEnvironment('FIDA_FIREBASE_SENDER_ID');
const _projectId = String.fromEnvironment('FIDA_FIREBASE_PROJECT_ID');
FirebaseOptions? _options() =>
    [_apiKey, _appId, _senderId, _projectId].any((s) => s.isEmpty)
    ? null
    : const FirebaseOptions(
        apiKey: _apiKey,
        appId: _appId,
        messagingSenderId: _senderId,
        projectId: _projectId,
      );
@pragma('vm:entry-point')
Future<void> _backgroundMessage(RemoteMessage message) async {
  final options = _options();
  if (options != null && Firebase.apps.isEmpty)
    await Firebase.initializeApp(options: options);
}

class FidaPush {
  static final messages = StreamController<RemoteMessage>.broadcast();
  StreamSubscription<String>? _refresh;
  StreamSubscription<RemoteMessage>? _foreground, _opened;
  String? _token;
  Future<void> Function(String, String)? _register;
  String state = 'Not configured';
  Future<void> start(
    String app,
    Future<void> Function(String, String) register,
  ) async {
    if (_register != null) return;
    _register = register;
    final options = _options();
    if (options == null) {
      state = 'Not configured';
      return;
    }
    try {
      if (Firebase.apps.isEmpty) await Firebase.initializeApp(options: options);
      FirebaseMessaging.onBackgroundMessage(_backgroundMessage);
      final permission = await FirebaseMessaging.instance.requestPermission();
      if (permission.authorizationStatus == AuthorizationStatus.denied) {
        state = 'Permission denied';
        _register = null;
        return;
      }
      _token = await FirebaseMessaging.instance.getToken();
      if (_token != null) await register('POST', _token!);
      _refresh = FirebaseMessaging.instance.onTokenRefresh.listen((
        token,
      ) async {
        try {
          if (_token != null && _token != token)
            await register('DELETE', _token!);
          _token = token;
          await register('POST', token);
        } catch (_) {
          state = 'Registration needs retry';
        }
      });
      _foreground = FirebaseMessaging.onMessage.listen(messages.add);
      _opened = FirebaseMessaging.onMessageOpenedApp.listen(messages.add);
      final initial = await FirebaseMessaging.instance.getInitialMessage();
      if (initial != null) messages.add(initial);
      state = 'Enabled';
    } catch (_) {
      state = 'Registration needs retry';
      _register = null;
    }
  }

  Future<void> stop() async {
    await _refresh?.cancel();
    await _foreground?.cancel();
    await _opened?.cancel();
    try {
      if (_token != null) await _register?.call('DELETE', _token!);
      if (Firebase.apps.isNotEmpty)
        await FirebaseMessaging.instance.deleteToken();
    } catch (_) {}
    _register = null;
    _token = null;
    state = 'Signed out';
  }
}

class PushMessageBanner extends StatefulWidget {
  const PushMessageBanner({super.key, required this.child});
  final Widget child;
  @override
  State<PushMessageBanner> createState() => _PushMessageBannerState();
}

class _PushMessageBannerState extends State<PushMessageBanner> {
  StreamSubscription<RemoteMessage>? subscription;
  RemoteMessage? message;
  @override
  void initState() {
    super.initState();
    subscription = FidaPush.messages.stream.listen((m) {
      if (mounted) setState(() => message = m);
    });
  }

  @override
  void dispose() {
    subscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      if (message != null)
        Material(
          color: const Color(0xFFDDF3E2),
          child: SafeArea(
            bottom: false,
            child: ListTile(
              leading: const Icon(
                Icons.notifications_active,
                color: Color(0xFF07855A),
              ),
              title: Text(
                message!.notification?.title ?? 'Order update',
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              subtitle: Text(
                message!.notification?.body ??
                    'Open your orders to see the latest update.',
              ),
              trailing: IconButton(
                tooltip: 'Dismiss',
                onPressed: () => setState(() => message = null),
                icon: const Icon(Icons.close),
              ),
            ),
          ),
        ),
      Expanded(child: widget.child),
    ],
  );
}
