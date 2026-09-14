import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../ui/format.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({
    super.key,
    required this.api,
    required this.merchant,
    required this.cart,
    required this.products,
  });

  final ApiClient api;
  final Map<String, dynamic> merchant;
  final Map<String, int> cart;
  final Map<String, Map<String, dynamic>> products;

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _addressLine = TextEditingController();
  final _city = TextEditingController();
  final _instructions = TextEditingController();
  List<Map<String, dynamic>> _addresses = [];
  String? _addressId;
  bool _newAddress = false;
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAddresses();
  }

  @override
  void dispose() {
    _addressLine.dispose();
    _city.dispose();
    _instructions.dispose();
    super.dispose();
  }

  Future<void> _loadAddresses() async {
    try {
      final rows = await widget.api.addresses();
      if (!mounted) return;
      final defaultAddress = rows.where((row) => row['isDefault'] == true).firstOrNull;
      setState(() {
        _addresses = rows;
        _addressId = (defaultAddress ?? (rows.isNotEmpty ? rows.first : null))?['id']?.toString();
        _newAddress = rows.isEmpty;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  double get _subtotal {
    var value = 0.0;
    for (final entry in widget.cart.entries) {
      value += asDouble(widget.products[entry.key]?['price']) * entry.value;
    }
    return value;
  }

  Future<void> _placeOrder() async {
    final branches = widget.merchant['branches'] as List? ?? const [];
    if (branches.isEmpty) {
      setState(() => _error = 'This merchant has no branch accepting orders.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      var addressId = _addressId;
      if (_newAddress) {
        if (_addressLine.text.trim().isEmpty) {
          setState(() => _error = 'Enter your delivery address.');
          return;
        }
        final saved = await widget.api.addAddress(
          addressLine: _addressLine.text.trim(),
          city: _city.text.trim().isEmpty ? null : _city.text.trim(),
          instructions: _instructions.text.trim().isEmpty ? null : _instructions.text.trim(),
          isDefault: _addresses.isEmpty,
        );
        addressId = saved['id'].toString();
      }

      if (addressId == null) {
        setState(() => _error = 'Select a delivery address.');
        return;
      }

      final order = await widget.api.createOrder(
        tenantId: widget.merchant['id'].toString(),
        branchId: (branches.first as Map)['id'].toString(),
        items: widget.cart.entries
            .map((entry) => {'productId': entry.key, 'quantity': entry.value})
            .toList(),
        paymentMethod: 'CASH',
        addressId: addressId,
        deliveryInstructions: _newAddress && _instructions.text.trim().isNotEmpty
            ? _instructions.text.trim()
            : null,
      );

      if (!mounted) return;
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          icon: const Icon(Icons.check_circle_rounded, size: 54),
          title: const Text('Order placed'),
          content: Text(
            'Order ${order['orderNumber']} was sent to ${widget.merchant['name']}.\n\nTotal: ${money(order['total'], currency: widget.merchant['currency']?.toString() ?? 'RWF')}',
            textAlign: TextAlign.center,
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Done'),
            ),
          ],
        ),
      );
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not place the order.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currency = widget.merchant['currency']?.toString() ?? 'RWF';
    final deliveryFee = asDouble(widget.merchant['defaultDeliveryFee']);
    final servicePercent = asDouble(widget.merchant['serviceFeePercent']);
    final serviceFee = _subtotal * servicePercent / 100;
    final estimatedTotal = _subtotal + deliveryFee + serviceFee;

    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
              children: [
                Text('Delivery address', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 12),
                if (_addresses.isNotEmpty)
                  SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(value: false, icon: Icon(Icons.bookmark_outline), label: Text('Saved')),
                      ButtonSegment(value: true, icon: Icon(Icons.add_location_alt_outlined), label: Text('New')),
                    ],
                    selected: {_newAddress},
                    onSelectionChanged: (selection) => setState(() => _newAddress = selection.first),
                  ),
                const SizedBox(height: 14),
                if (!_newAddress)
                  ..._addresses.map(
                    (address) => Card(
                      child: RadioListTile<String>(
                        value: address['id'].toString(),
                        groupValue: _addressId,
                        onChanged: (value) => setState(() => _addressId = value),
                        title: Text((address['label'] ?? address['addressLine']).toString()),
                        subtitle: Text([
                          address['addressLine'],
                          address['city'],
                        ].where((v) => v != null && '$v'.isNotEmpty).join(' · ')),
                      ),
                    ),
                  )
                else ...[
                  TextField(
                    controller: _addressLine,
                    decoration: const InputDecoration(
                      labelText: 'Street / building / landmark',
                      prefixIcon: Icon(Icons.location_on_outlined),
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _city,
                    decoration: const InputDecoration(labelText: 'City', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _instructions,
                    maxLines: 2,
                    decoration: const InputDecoration(
                      labelText: 'Delivery instructions (optional)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
                const SizedBox(height: 26),
                Text('Payment', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 12),
                const Card(
                  child: ListTile(
                    leading: Icon(Icons.payments_outlined),
                    title: Text('Cash on delivery'),
                    subtitle: Text('Mobile Money and card payment will be enabled after gateway integration.'),
                    trailing: Icon(Icons.check_circle_rounded),
                  ),
                ),
                const SizedBox(height: 26),
                Text('Order summary', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 12),
                for (final entry in widget.cart.entries)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(widget.products[entry.key]?['name']?.toString() ?? 'Product'),
                    subtitle: Text('${entry.value} × ${money(widget.products[entry.key]?['price'], currency: currency)}'),
                    trailing: Text(money(asDouble(widget.products[entry.key]?['price']) * entry.value, currency: currency)),
                  ),
                const Divider(),
                _PriceLine(label: 'Subtotal', value: money(_subtotal, currency: currency)),
                _PriceLine(label: 'Delivery', value: money(deliveryFee, currency: currency)),
                if (serviceFee > 0) _PriceLine(label: 'Service fee', value: money(serviceFee, currency: currency)),
                const SizedBox(height: 6),
                _PriceLine(label: 'Estimated total', value: money(estimatedTotal, currency: currency), strong: true),
                const SizedBox(height: 6),
                Text(
                  'The server recalculates product prices and fees before accepting the order.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                if (_error != null) ...[
                  const SizedBox(height: 14),
                  Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ],
              ],
            ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.all(16),
        child: FilledButton.icon(
          onPressed: _loading || _submitting ? null : _placeOrder,
          icon: _submitting
              ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.shopping_bag_rounded),
          label: Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Text('Place order · ${money(estimatedTotal, currency: currency)}'),
          ),
        ),
      ),
    );
  }
}

class _PriceLine extends StatelessWidget {
  const _PriceLine({required this.label, required this.value, this.strong = false});

  final String label;
  final String value;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final style = strong ? Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800) : null;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(label, style: style), Text(value, style: style)],
      ),
    );
  }
}
