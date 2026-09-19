import 'order_actions.dart';

import 'package:fida_mobile_common/fida_mobile_common.dart';

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../ui/format.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  StreamSubscription<dynamic>? _pushSubscription;
  List<Map<String, dynamic>> _orders = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    _pushSubscription = FidaPush.messages.stream.listen((_) {
      if (mounted && !_loading) _load();
    });
  }

  @override
  void dispose() {
    _pushSubscription?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await widget.api.orders();
      if (mounted) setState(() => _orders = rows);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Unable to load your orders.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());

    return RefreshIndicator(
      onRefresh: _load,
      child: _error != null
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                const SizedBox(height: 160),
                const Icon(Icons.receipt_long_outlined, size: 50),
                const SizedBox(height: 12),
                Center(child: Text(_error!)),
              ],
            )
          : _orders.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: const [
                SizedBox(height: 160),
                Icon(Icons.shopping_bag_outlined, size: 52),
                SizedBox(height: 12),
                Center(child: Text('Your orders will appear here.')),
              ],
            )
          : ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
              itemCount: _orders.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final order = _orders[index];
                final merchant = (order['tenant'] as Map?)
                    ?.cast<String, dynamic>();
                final currency = merchant?['currency']?.toString() ?? 'RWF';
                final items = order['items'] as List? ?? const [];
                return Card(
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () async {
                      await Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => OrderDetailScreen(
                            api: widget.api,
                            orderId: order['id'].toString(),
                          ),
                        ),
                      );
                      _load();
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  merchant?['name']?.toString() ?? 'Merchant',
                                  style: Theme.of(context).textTheme.titleMedium
                                      ?.copyWith(fontWeight: FontWeight.w800),
                                ),
                              ),
                              _StatusBadge(status: order['status'].toString()),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '${order['orderNumber']} · ${items.length} item type${items.length == 1 ? '' : 's'}',
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Text(
                                money(order['total'], currency: currency),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const Spacer(),
                              const Icon(Icons.chevron_right_rounded),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }
}

class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({
    super.key,
    required this.api,
    required this.orderId,
  });

  final ApiClient api;
  final String orderId;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  Map<String, dynamic>? _order;
  bool _loading = true;
  String? _error;
  Timer? _trackingTimer;

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final value = await widget.api.order(widget.orderId);
      if (mounted) setState(() => _order = value);
    } on ApiException catch (e) {
      if (!silent && mounted) setState(() => _error = e.message);
    } finally {
      if (!silent && mounted) setState(() => _loading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _load();
    _trackingTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      final status = _order?['status']?.toString();
      if (status != null &&
          !{'COMPLETED', 'CANCELLED', 'REJECTED'}.contains(status)) {
        _load(silent: true);
      }
    });
  }

  @override
  void dispose() {
    _trackingTimer?.cancel();
    super.dispose();
  }

  Future<void> _cancelOrder(Map<String, dynamic> order) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cancel order?'),
        content: const Text(
          'You can cancel this order because preparation has not started yet.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Keep order'),
          ),
          FilledButton.tonal(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Cancel order'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await widget.api.cancelOrder(order['id'].toString());
      await _load();
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Order cancelled.')));
    } on ApiException catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  double? _distanceToCustomerKm(
    Map<String, dynamic> order,
    Map<String, dynamic>? driver,
  ) {
    final lat1 = (driver?['latitude'] as num?)?.toDouble();
    final lon1 = (driver?['longitude'] as num?)?.toDouble();
    final lat2 = (order['deliveryLatitude'] as num?)?.toDouble();
    final lon2 = (order['deliveryLongitude'] as num?)?.toDouble();
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null)
      return null;

    double radians(double value) => value * math.pi / 180;
    final dLat = radians(lat2 - lat1);
    final dLon = radians(lon2 - lon1);
    final a =
        math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(radians(lat1)) *
            math.cos(radians(lat2)) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);
    return 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  }

  String? _lastLocationText(dynamic value) {
    if (value == null) return null;
    final parsed = DateTime.tryParse(value.toString());
    if (parsed == null) return null;
    final local = parsed.toLocal();
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    return 'Last location update $hour:$minute';
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Order details'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: _loading && order == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null && order == null
          ? Center(child: Text(_error!))
          : RefreshIndicator(onRefresh: _load, child: _detail(context, order!)),
    );
  }

  Widget _detail(BuildContext context, Map<String, dynamic> order) {
    final merchant = (order['tenant'] as Map?)?.cast<String, dynamic>() ?? {};
    final branch = (order['branch'] as Map?)?.cast<String, dynamic>() ?? {};
    final delivery = (order['delivery'] as Map?)?.cast<String, dynamic>();
    final driver = (delivery?['driver'] as Map?)?.cast<String, dynamic>();
    final driverUser = (driver?['user'] as Map?)?.cast<String, dynamic>();
    final items = order['items'] as List? ?? const [];
    final currency = merchant['currency']?.toString() ?? 'RWF';
    final isPickup = order['fulfillmentType']?.toString() == 'PICKUP';
    final status = order['status']?.toString() ?? '';
    final canCancel = status == 'PENDING' || status == 'ACCEPTED';
    final driverDistanceKm = _distanceToCustomerKm(order, driver);
    final lastLocation = _lastLocationText(driver?['lastSeenAt']);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 60),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primaryContainer,
            borderRadius: BorderRadius.circular(22),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      merchant['name']?.toString() ?? 'Merchant',
                      style: Theme.of(context).textTheme.titleLarge
                          ?.copyWith(fontWeight: FontWeight.w900),
                    ),
                  ),
                  _StatusBadge(status: order['status'].toString()),
                ],
              ),
              const SizedBox(height: 8),
              Text(order['orderNumber'].toString()),
              if (branch['name'] != null)
                Text(
                  '${branch['name']}${branch['city'] == null ? '' : ' · ${branch['city']}'}',
                ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        OrderActions(api: widget.api, order: order),
        Text(
          isPickup ? 'Order progress' : 'Delivery progress',
          style: Theme.of(context).textTheme.titleMedium
              ?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 10),
        _Progress(status: order['status'].toString()),
        if (!isPickup &&
            order['deliveryPin'] != null &&
            !['COMPLETED', 'CANCELLED', 'REJECTED'].contains(status))
          Card(
            color: const Color(0xFFE1F3D4),
            child: ListTile(
              leading: const Icon(Icons.verified_user_outlined),
              title: Text(
                'Delivery PIN: ${order['deliveryPin']}',
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 22,
                ),
              ),
              subtitle: const Text(
                'Share this PIN only when your order has arrived.',
              ),
            ),
          ),
        if (canCancel) ...[
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _loading ? null : () => _cancelOrder(order),
              icon: const Icon(Icons.cancel_outlined),
              label: const Text('Cancel order'),
            ),
          ),
        ],
        if (driver != null) ...[
          const SizedBox(height: 14),
          Card(
            child: ListTile(
              leading: const CircleAvatar(
                child: Icon(Icons.delivery_dining_rounded),
              ),
              title: Text(
                [
                  driverUser?['firstName'],
                  driverUser?['lastName'],
                ].where((v) => v != null && '$v'.trim().isNotEmpty).join(' '),
              ),
              subtitle: Text(
                driver['latitude'] != null && driver['longitude'] != null
                    ? 'Driver assigned · live location available'
                    : 'Driver assigned',
              ),
              trailing: driverUser?['phone'] == null
                  ? null
                  : IconButton(
                      tooltip: 'Call driver',
                      onPressed: () =>
                          callPhone(context, driverUser!['phone'].toString()),
                      icon: const Icon(Icons.phone_outlined),
                    ),
            ),
          ),
        ],
        if (!isPickup &&
            driver != null &&
            status != 'COMPLETED' &&
            status != 'CANCELLED' &&
            status != 'REJECTED') ...[
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.route_rounded),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Live delivery tracking',
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                      ),
                      _StatusBadge(
                        status: delivery?['status']?.toString() ?? status,
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (driverDistanceKm != null)
                    Text(
                      driverDistanceKm < 1
                          ? 'Driver is about ${(driverDistanceKm * 1000).round()} m from your delivery point.'
                          : 'Driver is about ${driverDistanceKm.toStringAsFixed(1)} km from your delivery point.',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    )
                  else
                    const Text('Waiting for the driver location update.'),
                  if (lastLocation != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      lastLocation,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                  const SizedBox(height: 4),
                  Text(
                    'This screen refreshes the driver position automatically every 15 seconds.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 22),
        Text(
          'Items',
          style: Theme.of(context).textTheme.titleMedium
              ?.copyWith(fontWeight: FontWeight.w800),
        ),
        for (final rawItem in items)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text((rawItem as Map)['productName'].toString()),
            subtitle: Text(
              '${rawItem['quantity']} × ${money(rawItem['unitPrice'], currency: currency)}',
            ),
            trailing: Text(money(rawItem['totalPrice'], currency: currency)),
          ),
        const Divider(),
        _PriceRow(
          label: 'Subtotal',
          value: money(order['subtotal'], currency: currency),
        ),
        _PriceRow(
          label: isPickup ? 'Pickup' : 'Delivery',
          value: isPickup
              ? 'Free'
              : money(order['deliveryFee'], currency: currency),
        ),
        if (asDouble(order['serviceFee']) > 0)
          _PriceRow(
            label: 'Service fee',
            value: money(order['serviceFee'], currency: currency),
          ),
        const SizedBox(height: 6),
        _PriceRow(
          label: 'Total',
          value: money(order['total'], currency: currency),
          strong: true,
        ),
        const SizedBox(height: 22),
        Text(
          isPickup ? 'Pickup from' : 'Deliver to',
          style: Theme.of(context).textTheme.titleMedium
              ?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        if (isPickup)
          Text(
            [branch['name'], branch['addressLine'], branch['city']]
                .where(
                  (value) =>
                      value != null && value.toString().trim().isNotEmpty,
                )
                .join(' · '),
          )
        else
          Text(order['deliveryAddress']?.toString() ?? 'No delivery address'),
        if (!isPickup &&
            (order['deliveryInstructions'] ?? '').toString().isNotEmpty)
          Text('Instructions: ${order['deliveryInstructions']}'),
      ],
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.secondaryContainer,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.replaceAll('_', ' ').toLowerCase(),
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _Progress extends StatelessWidget {
  const _Progress({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    const steps = [
      'PENDING',
      'ACCEPTED',
      'PREPARING',
      'READY_FOR_PICKUP',
      'PICKED_UP',
      'DELIVERING',
      'COMPLETED',
    ];
    final current = steps.indexOf(status);
    if (status == 'REJECTED' || status == 'CANCELLED') {
      return ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Icon(
          Icons.cancel_outlined,
          color: Theme.of(context).colorScheme.error,
        ),
        title: Text(
          status == 'REJECTED'
              ? 'Merchant could not accept this order'
              : 'Order cancelled',
        ),
      );
    }
    return Column(
      children: [
        LinearProgressIndicator(
          value: current < 0 ? 0 : (current + 1) / steps.length,
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerLeft,
          child: Text(status.replaceAll('_', ' ').toLowerCase()),
        ),
      ],
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({
    required this.label,
    required this.value,
    this.strong = false,
  });

  final String label;
  final String value;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final style = strong
        ? const TextStyle(fontWeight: FontWeight.w900, fontSize: 17)
        : null;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: style),
          Text(value, style: style),
        ],
      ),
    );
  }
}
