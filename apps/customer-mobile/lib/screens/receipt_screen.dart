import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../ui/format.dart';

class ReceiptScreen extends StatefulWidget {
  const ReceiptScreen({super.key, required this.api, required this.orderId});

  final ApiClient api;
  final String orderId;

  @override
  State<ReceiptScreen> createState() => _ReceiptScreenState();
}

class _ReceiptScreenState extends State<ReceiptScreen> {
  Map<String, dynamic>? _receipt;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final receipt = await widget.api.orderReceipt(widget.orderId);
      if (mounted) setState(() => _receipt = receipt);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final receipt = _receipt;
    return Scaffold(
      appBar: AppBar(title: const Text('Receipt', style: TextStyle(fontWeight: FontWeight.w900))),
      body: receipt == null
          ? Center(child: _error == null ? const CircularProgressIndicator() : Text(_error!))
          : _content(receipt),
    );
  }

  Widget _content(Map<String, dynamic> receipt) {
    final currency = receipt['currency']?.toString() ?? 'RWF';
    final items = receipt['items'] as List? ?? const [];
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 40),
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(22, 22, 22, 26),
          decoration: BoxDecoration(color: const Color(0xFFFFF3D8), borderRadius: BorderRadius.circular(22)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text('Fida', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),
                  const Spacer(),
                  Text(receipt['orderNumber']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w700)),
                ],
              ),
              const SizedBox(height: 28),
              const Text('Thanks for your order', style: TextStyle(fontSize: 31, height: 1.05, fontWeight: FontWeight.w900, letterSpacing: -1.1)),
              const SizedBox(height: 10),
              Text(receipt['merchantName']?.toString() ?? 'Fida Marketplace', style: const TextStyle(fontSize: 18)),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            const Text('Total', style: TextStyle(fontSize: 29, fontWeight: FontWeight.w900)),
            const Spacer(),
            Text(money(receipt['total'], currency: currency), style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w900)),
          ],
        ),
        const SizedBox(height: 24),
        for (final raw in items) ...[
          _ReceiptItem(item: (raw as Map).cast<String, dynamic>(), currency: currency),
          const SizedBox(height: 14),
        ],
        const Divider(height: 28),
        _Row(label: 'Subtotal', value: money(receipt['subtotal'], currency: currency)),
        if (asDouble(receipt['discount']) > 0)
          _Row(label: 'Promotion', value: '-${money(receipt['discount'], currency: currency)}', green: true),
        _Row(label: 'Delivery', value: asDouble(receipt['deliveryFee']) == 0 ? 'Free' : money(receipt['deliveryFee'], currency: currency)),
        if (asDouble(receipt['serviceFee']) > 0) _Row(label: 'Service fee', value: money(receipt['serviceFee'], currency: currency)),
        const SizedBox(height: 6),
        _Row(label: 'Total paid / due', value: money(receipt['total'], currency: currency), strong: true),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: const Color(0xFFF3F3F3), borderRadius: BorderRadius.circular(14)),
          child: Text(
            'Payment: ${(receipt['paymentMethod'] ?? '').toString().replaceAll('_', ' ')} · ${(receipt['paymentStatus'] ?? '').toString().replaceAll('_', ' ')}',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}

class _ReceiptItem extends StatelessWidget {
  const _ReceiptItem({required this.item, required this.currency});
  final Map<String, dynamic> item;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final modifiers = item['modifiers'] as List? ?? const [];
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('${item['quantity']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0E7A3D))),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item['productName'].toString(), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              for (final raw in modifiers)
                Text((raw as Map)['optionName'].toString(), style: const TextStyle(color: Colors.black54)),
            ],
          ),
        ),
        Text(money(item['totalPrice'], currency: currency), style: const TextStyle(fontSize: 17)),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.strong = false, this.green = false});
  final String label;
  final String value;
  final bool strong;
  final bool green;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(fontSize: strong ? 19 : 16, fontWeight: strong ? FontWeight.w900 : FontWeight.w500, color: green ? const Color(0xFF0E7A3D) : null);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(children: [Expanded(child: Text(label, style: style)), Text(value, style: style)]),
    );
  }
}
