import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../core/api_client.dart';

class LiveTrackingScreen extends StatefulWidget {
  const LiveTrackingScreen({super.key, required this.api, required this.orderId});

  final ApiClient api;
  final String orderId;

  @override
  State<LiveTrackingScreen> createState() => _LiveTrackingScreenState();
}

class _LiveTrackingScreenState extends State<LiveTrackingScreen> {
  Map<String, dynamic>? _tracking;
  String? _error;
  bool _loading = true;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final tracking = await widget.api.orderTracking(widget.orderId);
      if (!mounted) return;
      setState(() {
        _tracking = tracking;
        _error = null;
      });
      final status = tracking['orderStatus']?.toString();
      if ({'COMPLETED', 'CANCELLED', 'REJECTED'}.contains(status)) _timer?.cancel();
    } on ApiException catch (e) {
      if (!silent && mounted) setState(() => _error = e.message);
    } finally {
      if (!silent && mounted) setState(() => _loading = false);
    }
  }

  LatLng? _latLng(dynamic raw) {
    if (raw is! Map) return null;
    final lat = (raw['latitude'] as num?)?.toDouble();
    final lon = (raw['longitude'] as num?)?.toDouble();
    if (lat == null || lon == null) return null;
    return LatLng(lat, lon);
  }

  LatLng _center(List<LatLng> points) {
    if (points.isEmpty) return const LatLng(-1.9441, 30.0619);
    final lat = points.fold<double>(0, (sum, point) => sum + point.latitude) / points.length;
    final lon = points.fold<double>(0, (sum, point) => sum + point.longitude) / points.length;
    return LatLng(lat, lon);
  }

  String _statusTitle(String? status) => switch (status) {
        'PENDING' => 'Waiting for the merchant',
        'ACCEPTED' => 'Order accepted',
        'PREPARING' => 'Preparing your order',
        'READY_FOR_PICKUP' => 'Ready for pickup',
        'PICKED_UP' => 'Your order is on the move',
        'DELIVERING' => 'Heading your way…',
        'COMPLETED' => 'Delivered',
        'CANCELLED' => 'Order cancelled',
        'REJECTED' => 'Order rejected',
        _ => 'Tracking your order',
      };

  @override
  Widget build(BuildContext context) {
    if (_loading && _tracking == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_error != null && _tracking == null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.location_off_outlined, size: 48),
              const SizedBox(height: 10),
              Text(_error!),
              const SizedBox(height: 12),
              FilledButton(onPressed: _load, child: const Text('Try again')),
            ],
          ),
        ),
      );
    }

    final tracking = _tracking ?? const <String, dynamic>{};
    final driver = _latLng(tracking['driver']);
    final destination = _latLng(tracking['destination']);
    final pickup = _latLng(tracking['pickup']);
    final points = [if (pickup != null) pickup, if (driver != null) driver, if (destination != null) destination];
    final center = _center(points);
    final driverInfo = tracking['driver'] is Map ? (tracking['driver'] as Map).cast<String, dynamic>() : <String, dynamic>{};
    final orderStatus = tracking['orderStatus']?.toString();
    final deliveryStatus = tracking['deliveryStatus']?.toString();
    final refreshed = DateTime.now();

    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: FlutterMap(
              key: ValueKey('${driver?.latitude}:${driver?.longitude}:${orderStatus ?? ''}'),
              options: MapOptions(initialCenter: center, initialZoom: driver != null && destination != null ? 13.8 : 12.5),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.fidalix.marketplace.customer_mobile',
                ),
                if (points.length >= 2)
                  PolylineLayer(
                    polylines: [Polyline(points: points, strokeWidth: 4, color: Colors.black87)],
                  ),
                MarkerLayer(
                  markers: [
                    if (pickup != null)
                      Marker(
                        point: pickup,
                        width: 46,
                        height: 46,
                        child: const _MapMarker(icon: Icons.storefront_rounded, background: Colors.black),
                      ),
                    if (destination != null)
                      Marker(
                        point: destination,
                        width: 50,
                        height: 50,
                        child: const _MapMarker(icon: Icons.home_rounded, background: Color(0xFF246BFD)),
                      ),
                    if (driver != null)
                      Marker(
                        point: driver,
                        width: 58,
                        height: 58,
                        child: const _MapMarker(icon: Icons.delivery_dining_rounded, background: Color(0xFF0E7A3D)),
                      ),
                  ],
                ),
                const RichAttributionWidget(
                  attributions: [TextSourceAttribution('OpenStreetMap contributors')],
                ),
              ],
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _RoundAction(icon: Icons.close_rounded, onTap: () => Navigator.pop(context)),
                  Row(
                    children: [
                      _RoundAction(icon: Icons.refresh_rounded, onTap: _load),
                      const SizedBox(width: 10),
                      const _HelpPill(),
                    ],
                  ),
                ],
              ),
            ),
          ),
          Align(
            alignment: Alignment.topCenter,
            child: SafeArea(
              minimum: const EdgeInsets.fromLTRB(16, 78, 16, 0),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: const [BoxShadow(blurRadius: 18, color: Color(0x22000000))]),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_statusTitle(orderStatus), style: const TextStyle(fontSize: 25, fontWeight: FontWeight.w900, letterSpacing: -.7)),
                    const SizedBox(height: 4),
                    Text(
                      driver == null ? 'We’ll show the courier here as soon as a driver is assigned.' : 'Live location · refreshed every 5 seconds',
                      style: const TextStyle(fontSize: 15, color: Colors.black54),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: List.generate(
                        5,
                        (index) => Expanded(
                          child: Container(
                            margin: EdgeInsets.only(right: index == 4 ? 0 : 8),
                            height: 4,
                            decoration: BoxDecoration(
                              color: _progressIndex(orderStatus) >= index ? const Color(0xFF0E7A3D) : const Color(0xFFE4E4E4),
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: SafeArea(
              top: false,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
                  boxShadow: [BoxShadow(blurRadius: 22, color: Color(0x22000000), offset: Offset(0, -4))],
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 29,
                      backgroundColor: const Color(0xFFF1F1F1),
                      child: Icon(driver == null ? Icons.person_outline_rounded : Icons.delivery_dining_rounded, color: Colors.black87),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            (driverInfo['name'] ?? 'Courier not assigned').toString(),
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                          ),
                          Text(
                            deliveryStatus == null ? 'Order ${tracking['orderNumber'] ?? ''}' : deliveryStatus.replaceAll('_', ' ').toLowerCase(),
                            style: const TextStyle(color: Colors.black54),
                          ),
                          const SizedBox(height: 3),
                          Text('Updated ${refreshed.hour.toString().padLeft(2, '0')}:${refreshed.minute.toString().padLeft(2, '0')}', style: const TextStyle(fontSize: 12, color: Colors.black45)),
                        ],
                      ),
                    ),
                    if ((driverInfo['phone'] ?? '').toString().isNotEmpty)
                      Container(
                        width: 46,
                        height: 46,
                        decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFFF1F1F1)),
                        child: const Icon(Icons.phone_rounded),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  int _progressIndex(String? status) => switch (status) {
        'PENDING' => 0,
        'ACCEPTED' || 'PREPARING' => 1,
        'READY_FOR_PICKUP' => 2,
        'PICKED_UP' || 'DELIVERING' => 3,
        'COMPLETED' => 4,
        _ => 0,
      };
}

class _MapMarker extends StatelessWidget {
  const _MapMarker({required this.icon, required this.background});
  final IconData icon;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: background, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 4), boxShadow: const [BoxShadow(blurRadius: 8, color: Color(0x33000000))]),
      child: Icon(icon, color: Colors.white, size: 24),
    );
  }
}

class _RoundAction extends StatelessWidget {
  const _RoundAction({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(),
      elevation: 2,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(width: 52, height: 52, child: Icon(icon, size: 27)),
      ),
    );
  }
}

class _HelpPill extends StatelessWidget {
  const _HelpPill();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 18),
      alignment: Alignment.center,
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28), boxShadow: const [BoxShadow(blurRadius: 8, color: Color(0x22000000))]),
      child: const Text('Help', style: TextStyle(fontWeight: FontWeight.w800)),
    );
  }
}
