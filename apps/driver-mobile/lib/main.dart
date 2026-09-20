import 'package:fida_mobile_common/fida_mobile_common.dart';

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import 'api_client.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const FidaDriverApp());
}

class FidaDriverApp extends StatefulWidget {
  const FidaDriverApp({super.key});

  @override
  State<FidaDriverApp> createState() => _FidaDriverAppState();
}

class _FidaDriverAppState extends State<FidaDriverApp> {
  final api = DriverApiClient();
  Map<String, dynamic>? user;
  Map<String, dynamic>? driver;
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    await api.restore();
    user = await api.me();
    if (user != null) await _loadDriver();
    if (mounted) setState(() => loading = false);
  }

  Future<void> _loadDriver() async {
    try {
      driver = await api.profile();
      unawaited(api.startPush());
      error = null;
    } on DriverApiException catch (e) {
      error = e.message;
      driver = null;
    }
  }

  Future<bool> _login(String email, String password) async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      user = await api.login(email.trim(), password);
      await _loadDriver();
      return driver != null;
    } on DriverApiException catch (e) {
      error = e.message;
      return false;
    } catch (_) {
      error = 'Unable to connect to Fida Marketplace.';
      return false;
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _logout() async {
    await api.logout();
    if (!mounted) return;
    setState(() {
      user = null;
      driver = null;
      error = null;
    });
  }

  @override
  void dispose() {
    api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Fida Marketplace Driver',
      theme: fidaTheme(),
      builder: (context, child) =>
          PushMessageBanner(child: child ?? const SizedBox.shrink()),
      home: loading && user == null
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : user == null
          ? _LoginScreen(onLogin: _login, error: error, loading: loading)
          : driver == null
          ? _NotEnrolledScreen(message: error, onLogout: _logout)
          : _DriverHome(
              api: api,
              initialDriver: driver!,
              onDriverChanged: (value) => driver = value,
              onLogout: _logout,
            ),
    );
  }
}

class _LoginScreen extends StatefulWidget {
  const _LoginScreen({
    required this.onLogin,
    required this.error,
    required this.loading,
  });

  final Future<bool> Function(String, String) onLogin;
  final String? error;
  final bool loading;

  @override
  State<_LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<_LoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  bool obscure = true;

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.delivery_dining_rounded, size: 78),
                  const SizedBox(height: 16),
                  Text(
                    'Fida Marketplace',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const Text('Driver', textAlign: TextAlign.center),
                  const SizedBox(height: 8),
                  const Text(
                    'Sign in with the Fida account your merchant enrolled for delivery.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 28),
                  TextField(
                    controller: email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: password,
                    obscureText: obscure,
                    onSubmitted: (_) =>
                        widget.onLogin(email.text, password.text),
                    decoration: InputDecoration(
                      labelText: 'Password',
                      border: const OutlineInputBorder(),
                      suffixIcon: IconButton(
                        onPressed: () => setState(() => obscure = !obscure),
                        icon: Icon(
                          obscure
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                        ),
                      ),
                    ),
                  ),
                  if (widget.error != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      widget.error!,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: widget.loading
                        ? null
                        : () => widget.onLogin(email.text, password.text),
                    icon: widget.loading
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.login_rounded),
                    label: const Padding(
                      padding: EdgeInsets.symmetric(vertical: 14),
                      child: Text('Sign in'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _NotEnrolledScreen extends StatelessWidget {
  const _NotEnrolledScreen({required this.message, required this.onLogout});

  final String? message;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        actions: [
          IconButton(
            onPressed: onLogout,
            icon: const Icon(Icons.logout_rounded),
          ),
        ],
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.storefront_outlined, size: 64),
              const SizedBox(height: 14),
              const Text(
                'Merchant enrollment required',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              Text(
                message ??
                    'Ask the merchant you deliver for to enroll this Fida account as one of their drivers.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              const Text(
                'Fida Platform Admin does not approve merchant drivers.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.black54),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DriverHome extends StatefulWidget {
  const _DriverHome({
    required this.api,
    required this.initialDriver,
    required this.onDriverChanged,
    required this.onLogout,
  });

  final DriverApiClient api;
  final Map<String, dynamic> initialDriver;
  final ValueChanged<Map<String, dynamic>> onDriverChanged;
  final Future<void> Function() onLogout;

  @override
  State<_DriverHome> createState() => _DriverHomeState();
}

class _DriverHomeState extends State<_DriverHome> with WidgetsBindingObserver {
  late Map<String, dynamic> driver;
  List<Map<String, dynamic>> activeDeliveries = [];
  List<Map<String, dynamic>> offers = [];
  bool loading = true;
  String? error;
  StreamSubscription<Position>? positionSubscription;
  Timer? refreshTimer, locationHeartbeat;
  Position? lastPosition;
  bool sendingLocation = false;
  StreamSubscription<dynamic>? pushSubscription;

  bool get isOnline => driver['isOnline'] == true;
  bool get isAvailable => driver['isAvailable'] == true;
  Map get operator => driver['operator'] as Map? ?? {};
  Map get branch => driver['branch'] as Map? ?? {};
  String get operatorType => (operator['type'] ?? 'MERCHANT').toString();
  String get operatorName =>
      (operator['name'] ?? 'Merchant delivery').toString();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (mounted &&
          !loading &&
          WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed)
        _refresh();
    });
    driver = Map<String, dynamic>.from(widget.initialDriver);
    pushSubscription = FidaPush.messages.stream.listen((_) {
      if (mounted && !loading) _refresh();
    });
    _refresh();
    if (isOnline) _startLocationUpdates();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    refreshTimer?.cancel();
    locationHeartbeat?.cancel();
    positionSubscription?.cancel();
    pushSubscription?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      _refresh();
      if (isOnline && positionSubscription == null) _startLocationUpdates();
    }
  }

  Future<void> _sendPosition(Position position) async {
    if (sendingLocation || !isOnline || !mounted) return;
    sendingLocation = true;
    try {
      await widget.api.updateLocation(position.latitude, position.longitude);
    } catch (e) {
      if (mounted)
        setState(
          () => error = 'Location upload failed. Retrying while online.',
        );
    } finally {
      sendingLocation = false;
    }
  }

  Future<bool> _ensureLocationPermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      setState(() => error = 'Enable location services to go online.');
      return false;
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied)
      permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      setState(
        () =>
            error = 'Location permission is required while you are delivering.',
      );
      return false;
    }
    if (permission != LocationPermission.always && mounted) {
      final settings = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          title: const Text('Location during deliveries'),
          content: const Text(
            'Fida uses your location while you are online, including when the screen is locked or you use navigation. Customers can see it only during their active delivery. Choose Location → Allow all the time in app settings.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Stay offline'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Open settings'),
            ),
          ],
        ),
      );
      if (settings == true) await Geolocator.openAppSettings();
      return false;
    }
    return true;
  }

  Future<void> _startLocationUpdates() async {
    if (!await _ensureLocationPermission()) return;
    await positionSubscription?.cancel();

    final settings = AndroidSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 10,
      intervalDuration: const Duration(seconds: 10),
      foregroundNotificationConfig: const ForegroundNotificationConfig(
        notificationTitle: 'Fida delivery is active',
        notificationText: 'Sharing your location while you are online.',
        enableWakeLock: true,
      ),
    );
    positionSubscription =
        Geolocator.getPositionStream(locationSettings: settings).listen(
          (position) {
            lastPosition = position;
            _sendPosition(position);
          },
          onError: (Object e) {
            if (mounted)
              setState(
                () => error =
                    'Location updates interrupted. Check location permission and GPS.',
              );
          },
        );
    locationHeartbeat?.cancel();
    locationHeartbeat = Timer.periodic(const Duration(seconds: 20), (_) async {
      if (!isOnline || sendingLocation) return;
      try {
        final position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 12),
          ),
        );
        lastPosition = position;
        await _sendPosition(position);
      } catch (_) {}
    });

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: settings,
      );
      await widget.api.updateLocation(position.latitude, position.longitude);
    } catch (_) {}
  }

  Future<void> _refresh() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      driver = await widget.api.profile();
      activeDeliveries = await widget.api.activeDeliveries();
      if (driver['isOnline'] == true && driver['isAvailable'] == true) {
        offers = await widget.api.availableDeliveries();
      } else {
        offers = [];
      }
      widget.onDriverChanged(driver);
    } on DriverApiException catch (e) {
      error = e.message;
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _setOnline(bool value) async {
    if (value && !await _ensureLocationPermission()) return;
    try {
      driver = await widget.api.setAvailability(
        isOnline: value,
        isAvailable: value,
      );
      widget.onDriverChanged(driver);
      if (value) {
        await _startLocationUpdates();
      } else {
        await positionSubscription?.cancel();
        positionSubscription = null;
        locationHeartbeat?.cancel();
        lastPosition = null;
      }
      await _refresh();
    } on DriverApiException catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _setAvailable(bool value) async {
    try {
      driver = await widget.api.setAvailability(
        isOnline: isOnline,
        isAvailable: value,
      );
      widget.onDriverChanged(driver);
      await _refresh();
    } on DriverApiException catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _route() async {
    try {
      final plan = await widget.api.request('GET', '/v1/driver/route');
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        builder: (c) => SafeArea(
          child: DraggableScrollableSheet(
            expand: false,
            initialChildSize: .7,
            builder: (ctx, scroll) => ListView(
              controller: scroll,
              padding: const EdgeInsets.all(20),
              children: [
                const Text(
                  'Your delivery route',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900),
                ),
                const Text(
                  'Nearest-stop suggestion. Check road conditions before following the route.',
                ),
                for (final stop in plan['stops'] as List) ...[
                  const Divider(height: 28),
                  Text(
                    '${stop['kind']} · ${stop['orderNumber']}',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  Text(stop['address'].toString()),
                  DestinationActions(
                    latitude: stop['latitude'],
                    longitude: stop['longitude'],
                    address: stop['address'].toString(),
                    label: stop['kind'] == 'PICKUP' ? 'pickup' : 'customer',
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _claim(Map<String, dynamic> delivery) async {
    try {
      await widget.api.claim(delivery['id'].toString());
      await _refresh();
    } on DriverApiException catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _advance(Map<String, dynamic> delivery, String status) async {
    try {
      String? pin;
      if (status == 'DELIVERED') {
        String entered = '';
        pin = await showDialog<String>(
          context: context,
          builder: (c) => AlertDialog(
            title: const Text('Confirm customer delivery'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Ask the customer for the four-digit PIN shown on their order.',
                ),
                TextField(
                  keyboardType: TextInputType.number,
                  maxLength: 4,
                  onChanged: (v) => entered = v,
                  decoration: const InputDecoration(labelText: 'Delivery PIN'),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(c),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(c, entered),
                child: const Text('Confirm'),
              ),
            ],
          ),
        );
        if (pin == null) return;
      }
      await widget.api.request(
        'PATCH',
        '/v1/driver/deliveries/${delivery['id']}/status',
        body: {'status': status, if (pin != null) 'pin': pin},
      );
      await _refresh();
    } on DriverApiException catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  String? _nextStatus(String status) => switch (status) {
    'ASSIGNED' => 'AT_PICKUP',
    'AT_PICKUP' => 'PICKED_UP',
    'PICKED_UP' => 'AT_DROPOFF',
    'AT_DROPOFF' => 'DELIVERED',
    _ => null,
  };

  String _actionLabel(String next) => switch (next) {
    'AT_PICKUP' => 'Arrived at pickup',
    'PICKED_UP' => 'Confirm pickup',
    'AT_DROPOFF' => 'Arrived at customer',
    'DELIVERED' => 'Confirm delivery',
    _ => next,
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Fida Driver',
              style: TextStyle(fontWeight: FontWeight.w900),
            ),
            Text(
              operatorType == 'FIDA' ? 'Fida fleet' : operatorName,
              style: Theme.of(context).textTheme.labelSmall,
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: loading ? null : _refresh,
            icon: const Icon(Icons.refresh_rounded),
          ),
          IconButton(
            tooltip: 'Earnings',
            onPressed: () async {
              try {
                final rows =
                    await widget.api.request('GET', '/v1/driver/earnings')
                        as List;
                if (!context.mounted) return;
                await showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  builder: (c) => SafeArea(
                    child: ListView(
                      shrinkWrap: true,
                      padding: const EdgeInsets.all(24),
                      children: [
                        const Text(
                          'Delivery earnings',
                          style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const Text(
                          'Agreed estimates for completed deliveries. Settlement is handled by your delivery operator.',
                        ),
                        if (rows.isEmpty)
                          const Padding(
                            padding: EdgeInsets.all(24),
                            child: Text('No completed deliveries yet.'),
                          ),
                        for (final r in rows)
                          ListTile(
                            title: Text(r['order']['orderNumber'].toString()),
                            subtitle: Text(r['deliveredAt'].toString()),
                            trailing: Text(
                              r['estimatedPayout'] == null
                                  ? 'Not configured'
                                  : '${r['estimatedPayout']} ${r['payoutCurrency'] ?? 'RWF'}',
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              } catch (e) {
                if (context.mounted)
                  ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(SnackBar(content: Text('$e')));
              }
            },
            icon: const Icon(Icons.account_balance_wallet_outlined),
          ),
          IconButton(
            onPressed: () async {
              if (isOnline) await _setOnline(false);
              if (mounted) await widget.onLogout();
            },
            icon: const Icon(Icons.logout_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 90),
          children: [
            const FidaHero(
              title: 'Ready to deliver?',
              subtitle: 'Go online. Pick up. Make someone’s day.',
              icon: Icons.delivery_dining_rounded,
            ),
            _EnrollmentCard(operator: operator, branch: branch),
            const SizedBox(height: 10),
            _StatusCard(
              isOnline: isOnline,
              isAvailable: isAvailable,
              activeDeliveryCount: activeDeliveries.length,
              operatorType: operatorType,
              onOnlineChanged: loading ? null : _setOnline,
              onAvailableChanged: loading || !isOnline ? null : _setAvailable,
            ),
            if (error != null) ...[
              const SizedBox(height: 12),
              Card(
                color: Theme.of(context).colorScheme.errorContainer,
                child: ListTile(
                  leading: const Icon(Icons.error_outline_rounded),
                  title: Text(error!),
                ),
              ),
            ],
            const SizedBox(height: 18),
            if (activeDeliveries.isNotEmpty) ...[
              FilledButton.icon(
                onPressed: _route,
                icon: const Icon(Icons.route_rounded),
                label: const Text('Plan my delivery route'),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Active deliveries (${activeDeliveries.length})',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  if (loading)
                    const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              for (final delivery in activeDeliveries) ...[
                _CurrentDeliveryCard(
                  delivery: delivery,
                  nextStatus: _nextStatus(delivery['status'].toString()),
                  actionLabel: _actionLabel,
                  onAdvance: (status) => _advance(delivery, status),
                ),
                const SizedBox(height: 10),
              ],
              const SizedBox(height: 8),
            ],
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Delivery offers',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                if (loading && activeDeliveries.isEmpty)
                  const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              operatorType == 'FIDA'
                  ? 'Accept more pickup-ready orders while you are available.'
                  : 'Accept more pickup-ready orders from your merchant scope while you are available.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: Colors.black54),
            ),
            const SizedBox(height: 10),
            if (!isOnline)
              const _EmptyState(
                icon: Icons.power_settings_new_rounded,
                text: 'Go online to receive delivery offers.',
              )
            else if (!isAvailable)
              const _EmptyState(
                icon: Icons.pause_circle_outline_rounded,
                text: 'You are online but unavailable for new delivery offers.',
              )
            else if (!loading && offers.isEmpty)
              const _EmptyState(
                icon: Icons.delivery_dining_outlined,
                text:
                    'No pickup-ready deliveries are available in your delivery scope right now.',
              )
            else
              for (final delivery in offers) ...[
                _OfferCard(delivery: delivery, onClaim: () => _claim(delivery)),
                const SizedBox(height: 10),
              ],
          ],
        ),
      ),
    );
  }
}

class _EnrollmentCard extends StatelessWidget {
  const _EnrollmentCard({required this.operator, required this.branch});

  final Map operator;
  final Map branch;

  @override
  Widget build(BuildContext context) {
    final type = (operator['type'] ?? 'MERCHANT').toString();
    final operatorName = (operator['name'] ?? 'Merchant delivery').toString();
    final branchName = branch['name']?.toString();
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          child: Icon(
            type == 'FIDA'
                ? Icons.local_shipping_rounded
                : Icons.storefront_rounded,
          ),
        ),
        title: Text(
          type == 'FIDA' ? 'Fida delivery fleet' : operatorName,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        subtitle: Text(
          branchName == null || branchName.isEmpty
              ? 'Delivery scope: all merchant branches'
              : 'Delivery scope: $branchName',
        ),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.isOnline,
    required this.isAvailable,
    required this.activeDeliveryCount,
    required this.operatorType,
    required this.onOnlineChanged,
    required this.onAvailableChanged,
  });

  final bool isOnline;
  final bool isAvailable;
  final int activeDeliveryCount;
  final String operatorType;
  final ValueChanged<bool>? onOnlineChanged;
  final ValueChanged<bool>? onAvailableChanged;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: isOnline,
              onChanged: onOnlineChanged,
              secondary: Icon(
                isOnline
                    ? Icons.location_on_rounded
                    : Icons.location_off_outlined,
              ),
              title: Text(
                isOnline ? 'Online' : 'Offline',
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              subtitle: Text(
                isOnline
                    ? 'Location sharing is active while you are online.'
                    : 'You will not receive delivery offers.',
              ),
            ),
            const Divider(height: 1),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: isAvailable,
              onChanged: onAvailableChanged,
              secondary: Icon(
                activeDeliveryCount > 0
                    ? Icons.route_rounded
                    : Icons.check_circle_outline_rounded,
              ),
              title: Text(
                isAvailable
                    ? 'Available for deliveries'
                    : 'Not accepting new deliveries',
              ),
              subtitle: Text(
                activeDeliveryCount > 0
                    ? '$activeDeliveryCount active deliver${activeDeliveryCount == 1 ? 'y' : 'ies'} · ${isAvailable ? 'accepting more orders' : 'new offers paused'}'
                    : operatorType == 'FIDA'
                    ? 'Receive pickup-ready orders from the Fida fleet queue.'
                    : 'Receive pickup-ready orders from your merchant delivery queue.',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({required this.delivery, required this.onClaim});

  final Map<String, dynamic> delivery;
  final VoidCallback onClaim;

  @override
  Widget build(BuildContext context) {
    final order = delivery['order'] as Map? ?? {};
    final tenant = order['tenant'] as Map? ?? {};
    final branch = order['branch'] as Map? ?? {};
    final distance = delivery['distanceToPickupKm'];
    final payout = delivery['estimatedPayout'];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'DELIVERY OFFER',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.5,
                color: Color(0xFF07855A),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              payout == null
                  ? 'Pay not configured'
                  : '${payout} ${delivery['payoutCurrency'] ?? 'RWF'}',
              style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900),
            ),
            Text(
              payout == null
                  ? 'Ask your operator about pay before accepting.'
                  : 'Estimated earnings · excludes tips',
              style: const TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                const CircleAvatar(child: Icon(Icons.storefront_rounded)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        tenant['name']?.toString() ?? 'Merchant',
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                      Text(branch['name']?.toString() ?? 'Pickup branch'),
                    ],
                  ),
                ),
                if (distance != null)
                  Chip(label: Text('$distance km to pickup')),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              'Pickup: ${[branch['addressLine'], branch['city']].where((v) => v != null && '$v'.isNotEmpty).join(', ')}',
            ),
            Text('Drop-off: ${order['deliveryAddress'] ?? 'Customer address'}'),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: onClaim,
                icon: const Icon(Icons.delivery_dining_rounded),
                label: const Text('Accept delivery'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CurrentDeliveryCard extends StatelessWidget {
  const _CurrentDeliveryCard({
    required this.delivery,
    required this.nextStatus,
    required this.actionLabel,
    required this.onAdvance,
  });

  final Map<String, dynamic> delivery;
  final String? nextStatus;
  final String Function(String) actionLabel;
  final Future<void> Function(String) onAdvance;

  @override
  Widget build(BuildContext context) {
    final order = delivery['order'] as Map? ?? {};
    final tenant = order['tenant'] as Map? ?? {};
    final branch = order['branch'] as Map? ?? {};
    final customer = order['customer'] as Map? ?? {};
    final items = order['items'] as List? ?? const [];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DeliveryMap(
              pickupLatitude: branch['latitude'],
              pickupLongitude: branch['longitude'],
              dropoffLatitude: order['deliveryLatitude'],
              dropoffLongitude: order['deliveryLongitude'],
              height: 220,
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Delivery ${order['orderNumber'] ?? ''}',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                Chip(
                  label: Text(
                    delivery['status']
                        .toString()
                        .replaceAll('_', ' ')
                        .toLowerCase(),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            const Text(
              'PICKUP',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
            ),
            Text(
              tenant['name']?.toString() ?? 'Merchant',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
            ),
            Text(
              [
                branch['name'],
                branch['addressLine'],
                branch['city'],
              ].where((v) => v != null && '$v'.isNotEmpty).join(' · '),
            ),
            const SizedBox(height: 8),
            DestinationActions(
              latitude: branch['latitude'],
              longitude: branch['longitude'],
              address: [
                branch['addressLine'],
                branch['city'],
              ].whereType<String>().join(', '),
              label: 'pickup',
            ),
            const SizedBox(height: 14),
            const Text(
              'DROP-OFF',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
            ),
            Text(
              order['deliveryAddress']?.toString() ?? 'Customer address',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
            ),
            Text(
              [
                customer['firstName'],
                customer['lastName'],
              ].where((v) => v != null && '$v'.isNotEmpty).join(' '),
            ),
            if (customer['phone'] != null)
              TextButton.icon(
                onPressed: () =>
                    callPhone(context, customer['phone'].toString()),
                icon: const Icon(Icons.phone_rounded),
                label: Text(customer['phone'].toString()),
              ),
            DestinationActions(
              latitude: order['deliveryLatitude'],
              longitude: order['deliveryLongitude'],
              address: order['deliveryAddress']?.toString() ?? '',
            ),
            if ((order['deliveryInstructions'] ?? '')
                .toString()
                .isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('Instructions: ${order['deliveryInstructions']}'),
            ],
            const SizedBox(height: 14),
            Text(
              '${items.length} item type${items.length == 1 ? '' : 's'} · Order ${order['orderNumber']}',
            ),
            if (nextStatus != null) ...[
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => onAdvance(nextStatus!),
                  icon: const Icon(Icons.arrow_forward_rounded),
                  label: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text(actionLabel(nextStatus!)),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(
        children: [
          Icon(icon, size: 58),
          const SizedBox(height: 12),
          Text(text, textAlign: TextAlign.center),
        ],
      ),
    );
  }
}
