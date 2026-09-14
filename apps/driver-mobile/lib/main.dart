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
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF176B55),
        scaffoldBackgroundColor: const Color(0xFFF8FAF9),
      ),
      home: loading && user == null
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : user == null
              ? _LoginScreen(onLogin: _login, error: error, loading: loading)
              : driver == null
                  ? _NotApprovedScreen(message: error, onLogout: _logout)
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
  const _LoginScreen({required this.onLogin, required this.error, required this.loading});

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
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900),
                  ),
                  const Text('Driver', textAlign: TextAlign.center),
                  const SizedBox(height: 32),
                  TextField(
                    controller: email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: password,
                    obscureText: obscure,
                    onSubmitted: (_) => widget.onLogin(email.text, password.text),
                    decoration: InputDecoration(
                      labelText: 'Password',
                      border: const OutlineInputBorder(),
                      suffixIcon: IconButton(
                        onPressed: () => setState(() => obscure = !obscure),
                        icon: Icon(obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                      ),
                    ),
                  ),
                  if (widget.error != null) ...[
                    const SizedBox(height: 12),
                    Text(widget.error!, textAlign: TextAlign.center, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ],
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: widget.loading ? null : () => widget.onLogin(email.text, password.text),
                    icon: widget.loading
                        ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.login_rounded),
                    label: const Padding(padding: EdgeInsets.symmetric(vertical: 14), child: Text('Sign in')),
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

class _NotApprovedScreen extends StatelessWidget {
  const _NotApprovedScreen({required this.message, required this.onLogout});

  final String? message;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(actions: [IconButton(onPressed: onLogout, icon: const Icon(Icons.logout_rounded))]),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.badge_outlined, size: 64),
              const SizedBox(height: 14),
              const Text('Driver approval required', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
              const SizedBox(height: 8),
              Text(
                message ?? 'Your account has not yet been approved as a Fida Marketplace driver.',
                textAlign: TextAlign.center,
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

class _DriverHomeState extends State<_DriverHome> {
  late Map<String, dynamic> driver;
  Map<String, dynamic>? current;
  List<Map<String, dynamic>> offers = [];
  bool loading = true;
  String? error;
  StreamSubscription<Position>? positionSubscription;

  bool get isOnline => driver['isOnline'] == true;
  bool get isAvailable => driver['isAvailable'] == true;

  @override
  void initState() {
    super.initState();
    driver = Map<String, dynamic>.from(widget.initialDriver);
    _refresh();
    if (isOnline) _startLocationUpdates();
  }

  @override
  void dispose() {
    positionSubscription?.cancel();
    super.dispose();
  }

  Future<bool> _ensureLocationPermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      setState(() => error = 'Enable location services to go online.');
      return false;
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      setState(() => error = 'Location permission is required while you are delivering.');
      return false;
    }
    return true;
  }

  Future<void> _startLocationUpdates() async {
    if (!await _ensureLocationPermission()) return;
    await positionSubscription?.cancel();

    const settings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 25,
    );
    positionSubscription = Geolocator.getPositionStream(locationSettings: settings).listen(
      (position) async {
        try {
          await widget.api.updateLocation(position.latitude, position.longitude);
        } catch (_) {
          // A later position update will retry automatically.
        }
      },
    );

    try {
      final position = await Geolocator.getCurrentPosition(locationSettings: settings);
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
      current = await widget.api.currentDelivery();
      if (driver['isOnline'] == true && driver['isAvailable'] == true && current == null) {
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
      driver = await widget.api.setAvailability(isOnline: value, isAvailable: value);
      widget.onDriverChanged(driver);
      if (value) {
        await _startLocationUpdates();
      } else {
        await positionSubscription?.cancel();
        positionSubscription = null;
      }
      await _refresh();
    } on DriverApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _setAvailable(bool value) async {
    try {
      driver = await widget.api.setAvailability(isOnline: isOnline, isAvailable: value);
      widget.onDriverChanged(driver);
      await _refresh();
    } on DriverApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _claim(Map<String, dynamic> delivery) async {
    try {
      await widget.api.claim(delivery['id'].toString());
      await _refresh();
    } on DriverApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _advance(String status) async {
    final delivery = current;
    if (delivery == null) return;
    try {
      await widget.api.updateDeliveryStatus(delivery['id'].toString(), status);
      await _refresh();
    } on DriverApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
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
        title: const Text('Fida Driver', style: TextStyle(fontWeight: FontWeight.w900)),
        actions: [
          IconButton(onPressed: loading ? null : _refresh, icon: const Icon(Icons.refresh_rounded)),
          IconButton(onPressed: widget.onLogout, icon: const Icon(Icons.logout_rounded)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 90),
          children: [
            _StatusCard(
              isOnline: isOnline,
              isAvailable: isAvailable,
              hasDelivery: current != null,
              onOnlineChanged: loading ? null : _setOnline,
              onAvailableChanged: loading || !isOnline || current != null ? null : _setAvailable,
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
            if (current != null)
              _CurrentDeliveryCard(
                delivery: current!,
                nextStatus: _nextStatus((current!['status']).toString()),
                actionLabel: _actionLabel,
                onAdvance: _advance,
              )
            else ...[
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Delivery offers',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                    ),
                  ),
                  if (loading) const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                ],
              ),
              const SizedBox(height: 10),
              if (!isOnline)
                const _EmptyState(icon: Icons.power_settings_new_rounded, text: 'Go online to receive delivery offers.')
              else if (!isAvailable)
                const _EmptyState(icon: Icons.pause_circle_outline_rounded, text: 'You are online but unavailable for new deliveries.')
              else if (!loading && offers.isEmpty)
                const _EmptyState(icon: Icons.delivery_dining_outlined, text: 'No pickup-ready deliveries are available right now.')
              else
                for (final delivery in offers) ...[
                  _OfferCard(delivery: delivery, onClaim: () => _claim(delivery)),
                  const SizedBox(height: 10),
                ],
            ],
          ],
        ),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.isOnline,
    required this.isAvailable,
    required this.hasDelivery,
    required this.onOnlineChanged,
    required this.onAvailableChanged,
  });

  final bool isOnline;
  final bool isAvailable;
  final bool hasDelivery;
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
              secondary: Icon(isOnline ? Icons.location_on_rounded : Icons.location_off_outlined),
              title: Text(isOnline ? 'Online' : 'Offline', style: const TextStyle(fontWeight: FontWeight.w800)),
              subtitle: Text(isOnline ? 'Location sharing is active while delivering.' : 'You will not receive delivery offers.'),
            ),
            const Divider(height: 1),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: isAvailable,
              onChanged: onAvailableChanged,
              secondary: Icon(hasDelivery ? Icons.route_rounded : Icons.check_circle_outline_rounded),
              title: Text(hasDelivery ? 'Active delivery' : 'Available for deliveries'),
              subtitle: Text(hasDelivery ? 'Finish your current delivery first.' : 'Allow Fida to offer you pickup-ready orders.'),
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const CircleAvatar(child: Icon(Icons.storefront_rounded)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(tenant['name']?.toString() ?? 'Merchant', style: const TextStyle(fontWeight: FontWeight.w900)),
                      Text(branch['name']?.toString() ?? 'Pickup branch'),
                    ],
                  ),
                ),
                if (distance != null) Chip(label: Text('$distance km')),
              ],
            ),
            const SizedBox(height: 10),
            Text('Pickup: ${[branch['addressLine'], branch['city']].where((v) => v != null && '$v'.isNotEmpty).join(', ')}'),
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
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Active delivery',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                  ),
                ),
                Chip(label: Text(delivery['status'].toString().replaceAll('_', ' ').toLowerCase())),
              ],
            ),
            const SizedBox(height: 14),
            const Text('PICKUP', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
            Text(tenant['name']?.toString() ?? 'Merchant', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
            Text([branch['name'], branch['addressLine'], branch['city']].where((v) => v != null && '$v'.isNotEmpty).join(' · ')),
            const SizedBox(height: 14),
            const Text('DROP-OFF', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
            Text(order['deliveryAddress']?.toString() ?? 'Customer address', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
            Text([customer['firstName'], customer['lastName']].where((v) => v != null && '$v'.isNotEmpty).join(' ')),
            if (customer['phone'] != null) Text(customer['phone'].toString()),
            if ((order['deliveryInstructions'] ?? '').toString().isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('Instructions: ${order['deliveryInstructions']}'),
            ],
            const SizedBox(height: 14),
            Text('${items.length} item type${items.length == 1 ? '' : 's'} · Order ${order['orderNumber']}'),
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
