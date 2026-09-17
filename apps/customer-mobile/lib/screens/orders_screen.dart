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
  List<Map<String, dynamic>> _orders = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
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
                    final merchant = (order['tenant'] as Map?)?.cast<String, dynamic>();
                    final currency = merchant?['currency']?.toString() ?? 'RWF';
                    final items = order['items'] as List? ?? const [];
                    return Card(
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () async {
                          await Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => OrderDetailScreen(api: widget.api, orderId: order['id'].toString()),
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
                                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                                    ),
                                  ),
                                  _StatusBadge(status: order['status'].toString()),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text('${order['orderNumber']} · ${items.length} item type${items.length == 1 ? '' : 's'}'),
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  Text(money(order['total'], currency: currency), style: const TextStyle(fontWeight: FontWeight.w800)),
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
  const OrderDetailScreen({super.key, required this.api, required this.orderId});

  final ApiClient api;
  final String orderId;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  Map<String, dynamic>? _order;
  bool _loading = true;
  String? _error;

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final value = await widget.api.order(widget.orderId);
      if (mounted) setState(() => _order = value);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Order details'),
        actions: [IconButton(onPressed: _loading ? null : _load, icon: const Icon(Icons.refresh_rounded))],
      ),
      body: _loading && order == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null && order == null
              ? Center(child: Text(_error!))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _detail(context, order!),
                ),
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
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                    ),
                  ),
                  _StatusBadge(status: order['status'].toString()),
                ],
              ),
              const SizedBox(height: 8),
              Text(order['orderNumber'].toString()),
              if (branch['name'] != null) Text('${branch['name']}${branch['city'] == null ? '' : ' · ${branch['city']}'}'),
            ],
          ),
        ),
        const SizedBox(height: 22),
        Text(isPickup ? 'Order progress' : 'Delivery progress', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        _Progress(status: order['status'].toString()),
        if (driver != null) ...[
          const SizedBox(height: 14),
          Card(
            child: ListTile(
              leading: const CircleAvatar(child: Icon(Icons.delivery_dining_rounded)),
              title: Text(
                [driverUser?['firstName'], driverUser?['lastName']]
                    .where((v) => v != null && '$v'.trim().isNotEmpty)
                    .join(' '),
              ),
              subtitle: Text(
                driver['latitude'] != null && driver['longitude'] != null
                    ? 'Driver assigned · location updated'
                    : 'Driver assigned',
              ),
              trailing: driverUser?['phone'] == null ? null : const Icon(Icons.phone_outlined),
            ),
          ),
        ],
        const SizedBox(height: 22),
        Text('Items', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
        for (final rawItem in items)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text((rawItem as Map)['productName'].toString()),
            subtitle: Text('${rawItem['quantity']} × ${money(rawItem['unitPrice'], currency: currency)}'),
            trailing: Text(money(rawItem['totalPrice'], currency: currency)),
          ),
        const Divider(),
        _PriceRow(label: 'Subtotal', value: money(order['subtotal'], currency: currency)),
        _PriceRow(
          label: isPickup ? 'Pickup' : 'Delivery',
          value: isPickup ? 'Free' : money(order['deliveryFee'], currency: currency),
        ),
        if (asDouble(order['serviceFee']) > 0) _PriceRow(label: 'Service fee', value: money(order['serviceFee'], currency: currency)),
        const SizedBox(height: 6),
        _PriceRow(label: 'Total', value: money(order['total'], currency: currency), strong: true),
        const SizedBox(height: 22),
        Text(isPickup ? 'Pickup from' : 'Deliver to', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        if (isPickup)
          Text([
            branch['name'],
            branch['addressLine'],
            branch['city'],
          ].where((value) => value != null && value.toString().trim().isNotEmpty).join(' · '))
        else
          Text(order['deliveryAddress']?.toString() ?? 'No delivery address'),
        if (!isPickup && (order['deliveryInstructions'] ?? '').toString().isNotEmpty)
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
      child: Text(status.replaceAll('_', ' ').toLowerCase(), style: const TextStyle(fontWeight: FontWeight.w700)),
    );
  }
}

class _Progress extends StatelessWidget {
  const _Progress({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    const steps = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'DELIVERING', 'COMPLETED'];
    final current = steps.indexOf(status);
    if (status == 'REJECTED' || status == 'CANCELLED') {
      return ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Icon(Icons.cancel_outlined, color: Theme.of(context).colorScheme.error),
        title: Text(status == 'REJECTED' ? 'Merchant could not accept this order' : 'Order cancelled'),
      );
    }
    return Column(
      children: [
        LinearProgressIndicator(value: current < 0 ? 0 : (current + 1) / steps.length),
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
  const _PriceRow({required this.label, required this.value, this.strong = false});

  final String label;
  final String value;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final style = strong ? const TextStyle(fontWeight: FontWeight.w900, fontSize: 17) : null;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(label, style: style), Text(value, style: style)],
      ),
    );
  }
}
