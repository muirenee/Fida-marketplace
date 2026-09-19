import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../ui/format.dart';
import 'live_tracking_screen.dart';
import 'receipt_screen.dart';

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
                const SizedBox(height: 150),
                const Icon(Icons.receipt_long_outlined, size: 54),
                const SizedBox(height: 12),
                Center(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 24), child: Text(_error!, textAlign: TextAlign.center))),
              ],
            )
          : _orders.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: const [
                    SizedBox(height: 150),
                    Icon(Icons.shopping_bag_outlined, size: 54),
                    SizedBox(height: 12),
                    Center(child: Text('Your orders will appear here.')),
                  ],
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
                  itemCount: _orders.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 14),
                  itemBuilder: (context, index) {
                    final order = _orders[index];
                    final merchant = (order['tenant'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
                    final currency = merchant['currency']?.toString() ?? 'RWF';
                    final status = order['status']?.toString() ?? '';
                    final active = !_isTerminal(status);
                    return InkWell(
                      borderRadius: BorderRadius.circular(20),
                      onTap: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => OrderDetailScreen(api: widget.api, orderId: order['id'].toString())),
                        );
                        _load();
                      },
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(border: Border.all(color: const Color(0xFFE9E9E9)), borderRadius: BorderRadius.circular(20)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 54,
                                  height: 54,
                                  decoration: BoxDecoration(color: const Color(0xFFF3F3F3), borderRadius: BorderRadius.circular(14)),
                                  child: const Icon(Icons.storefront_rounded),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(merchant['name']?.toString() ?? 'Merchant', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                                      const SizedBox(height: 2),
                                      Text(_statusLabel(status), style: TextStyle(color: active ? const Color(0xFF0E7A3D) : Colors.black54, fontWeight: FontWeight.w700)),
                                    ],
                                  ),
                                ),
                                const Icon(Icons.chevron_right_rounded),
                              ],
                            ),
                            const SizedBox(height: 15),
                            Row(
                              children: [
                                Text(order['orderNumber']?.toString() ?? '', style: const TextStyle(color: Colors.black54)),
                                const Spacer(),
                                Text(money(order['total'], currency: currency), style: const TextStyle(fontWeight: FontWeight.w900)),
                              ],
                            ),
                            if (active && order['fulfillmentType']?.toString() == 'DELIVERY') ...[
                              const SizedBox(height: 13),
                              SizedBox(
                                width: double.infinity,
                                child: FilledButton.tonalIcon(
                                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => LiveTrackingScreen(api: widget.api, orderId: order['id'].toString()))),
                                  icon: const Icon(Icons.near_me_outlined),
                                  label: const Text('Track order'),
                                  style: FilledButton.styleFrom(backgroundColor: const Color(0xFFF1F1F1), foregroundColor: Colors.black),
                                ),
                              ),
                            ],
                          ],
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
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 10), (_) {
      final status = _order?['status']?.toString();
      if (status != null && !_isTerminal(status)) _load(silent: true);
    });
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
      final value = await widget.api.order(widget.orderId);
      if (!mounted) return;
      setState(() => _order = value);
      if (_isTerminal(value['status']?.toString() ?? '')) _timer?.cancel();
    } on ApiException catch (e) {
      if (!silent && mounted) setState(() => _error = e.message);
    } finally {
      if (!silent && mounted) setState(() => _loading = false);
    }
  }

  Future<void> _cancelOrder() async {
    final order = _order;
    if (order == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cancel order?'),
        content: const Text('Orders can only be cancelled before preparation begins.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Keep order')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Cancel order')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await widget.api.cancelOrder(order['id'].toString());
      await _load();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;
    return Scaffold(
      appBar: AppBar(title: const Text('Order', style: TextStyle(fontWeight: FontWeight.w900))),
      body: _loading && order == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null && order == null
              ? Center(child: Text(_error!))
              : RefreshIndicator(onRefresh: _load, child: _content(order!)),
    );
  }

  Widget _content(Map<String, dynamic> order) {
    final merchant = (order['tenant'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
    final branch = (order['branch'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
    final delivery = (order['delivery'] as Map?)?.cast<String, dynamic>();
    final driver = (delivery?['driver'] as Map?)?.cast<String, dynamic>();
    final driverUser = (driver?['user'] as Map?)?.cast<String, dynamic>();
    final items = order['items'] as List? ?? const [];
    final currency = merchant['currency']?.toString() ?? 'RWF';
    final status = order['status']?.toString() ?? '';
    final deliveryOrder = order['fulfillmentType']?.toString() == 'DELIVERY';
    final canCancel = status == 'PENDING' || status == 'ACCEPTED';

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 60),
      children: [
        Text(merchant['name']?.toString() ?? 'Merchant', style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900, letterSpacing: -1)),
        const SizedBox(height: 5),
        Text(order['orderNumber']?.toString() ?? '', style: const TextStyle(color: Colors.black54)),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(color: const Color(0xFFF4F4F4), borderRadius: BorderRadius.circular(18)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_statusLabel(status), style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w900)),
              const SizedBox(height: 12),
              _Progress(status: status),
              if (driverUser != null) ...[
                const SizedBox(height: 14),
                Text(
                  [driverUser['firstName'], driverUser['lastName']].where((value) => value != null && '$value'.trim().isNotEmpty).join(' '),
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ],
            ],
          ),
        ),
        if (deliveryOrder && !_isTerminal(status)) ...[
          const SizedBox(height: 14),
          SizedBox(
            height: 54,
            child: FilledButton.icon(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => LiveTrackingScreen(api: widget.api, orderId: widget.orderId))),
              icon: const Icon(Icons.near_me_rounded),
              label: const Text('Track delivery', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
            ),
          ),
        ],
        if (canCancel) ...[
          const SizedBox(height: 10),
          SizedBox(width: double.infinity, child: OutlinedButton(onPressed: _cancelOrder, child: const Text('Cancel order'))),
        ],
        const SizedBox(height: 28),
        const Text('Items', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
        const SizedBox(height: 8),
        for (final raw in items) _OrderItemRow(item: (raw as Map).cast<String, dynamic>(), currency: currency),
        const Divider(height: 30),
        _PriceRow(label: 'Subtotal', value: money(order['subtotal'], currency: currency)),
        if (asDouble(order['discount']) > 0) _PriceRow(label: 'Promotion', value: '-${money(order['discount'], currency: currency)}', green: true),
        _PriceRow(label: deliveryOrder ? 'Delivery' : 'Pickup', value: deliveryOrder ? (asDouble(order['deliveryFee']) == 0 ? 'Free' : money(order['deliveryFee'], currency: currency)) : 'Free'),
        if (asDouble(order['serviceFee']) > 0) _PriceRow(label: 'Service fee', value: money(order['serviceFee'], currency: currency)),
        const SizedBox(height: 5),
        _PriceRow(label: 'Total', value: money(order['total'], currency: currency), strong: true),
        const SizedBox(height: 28),
        Text(deliveryOrder ? 'Deliver to' : 'Pickup from', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
        const SizedBox(height: 7),
        Text(
          deliveryOrder
              ? order['deliveryAddress']?.toString() ?? 'Delivery address'
              : [branch['name'], branch['addressLine'], branch['city']].where((value) => value != null && '$value'.trim().isNotEmpty).join(' · '),
          style: const TextStyle(fontSize: 16, height: 1.35),
        ),
        const SizedBox(height: 28),
        SizedBox(
          width: double.infinity,
          child: FilledButton.tonalIcon(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ReceiptScreen(api: widget.api, orderId: widget.orderId))),
            icon: const Icon(Icons.receipt_long_outlined),
            label: const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('View receipt')),
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFF1F1F1), foregroundColor: Colors.black),
          ),
        ),
      ],
    );
  }
}

class _OrderItemRow extends StatelessWidget {
  const _OrderItemRow({required this.item, required this.currency});
  final Map<String, dynamic> item;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final modifiers = item['modifiers'] as List? ?? const [];
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: const Color(0xFFF1F1F1), borderRadius: BorderRadius.circular(9)),
            child: Text('${item['quantity']}', style: const TextStyle(fontWeight: FontWeight.w900)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item['productName'].toString(), style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800)),
                for (final raw in modifiers)
                  Text((raw as Map)['optionName'].toString(), style: const TextStyle(color: Colors.black54)),
              ],
            ),
          ),
          Text(money(item['totalPrice'], currency: currency)),
        ],
      ),
    );
  }
}

class _Progress extends StatelessWidget {
  const _Progress({required this.status});
  final String status;

  int get _step {
    if (status == 'COMPLETED') return 4;
    if (status == 'PICKED_UP' || status == 'DELIVERING') return 3;
    if (status == 'READY_FOR_PICKUP') return 2;
    if (status == 'ACCEPTED' || status == 'PREPARING') return 1;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(
        5,
        (index) => Expanded(
          child: Container(
            height: 5,
            margin: EdgeInsets.only(right: index == 4 ? 0 : 7),
            decoration: BoxDecoration(color: _step >= index ? const Color(0xFF0E7A3D) : const Color(0xFFDADADA), borderRadius: BorderRadius.circular(8)),
          ),
        ),
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({required this.label, required this.value, this.strong = false, this.green = false});
  final String label;
  final String value;
  final bool strong;
  final bool green;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(fontSize: strong ? 19 : 16, fontWeight: strong ? FontWeight.w900 : FontWeight.w500, color: green ? const Color(0xFF0E7A3D) : null);
    return Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(children: [Expanded(child: Text(label, style: style)), Text(value, style: style)]));
  }
}

bool _isTerminal(String status) => status == 'COMPLETED' || status == 'CANCELLED' || status == 'REJECTED';

String _statusLabel(String status) {
  if (status == 'PENDING') return 'Waiting for merchant';
  if (status == 'ACCEPTED') return 'Order accepted';
  if (status == 'PREPARING') return 'Preparing your order';
  if (status == 'READY_FOR_PICKUP') return 'Ready for pickup';
  if (status == 'PICKED_UP') return 'Picked up';
  if (status == 'DELIVERING') return 'Heading your way';
  if (status == 'COMPLETED') return 'Completed';
  if (status == 'CANCELLED') return 'Cancelled';
  if (status == 'REJECTED') return 'Rejected';
  return status.replaceAll('_', ' ').toLowerCase();
}
