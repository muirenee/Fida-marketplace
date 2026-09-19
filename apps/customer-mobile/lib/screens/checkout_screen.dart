import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../core/api_client.dart';
import '../models/cart_line.dart';
import '../ui/format.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({
    super.key,
    required this.api,
    required this.merchant,
    required this.cartLines,
    this.promoCode,
    this.promoEstimate,
  });

  final ApiClient api;
  final Map<String, dynamic> merchant;
  final List<CartLine> cartLines;
  final String? promoCode;
  final Map<String, dynamic>? promoEstimate;

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _addressLine = TextEditingController();
  final _city = TextEditingController();
  final _instructions = TextEditingController();

  List<Map<String, dynamic>> _addresses = [];
  String? _addressId;
  String _fulfillment = 'DELIVERY';
  bool _newAddress = false;
  bool _loading = true;
  bool _submitting = false;
  bool _locating = false;
  bool _quoteLoading = false;
  String? _error;
  double? _latitude;
  double? _longitude;
  double? _deliveryPrice;
  double? _distanceKm;

  Map<String, dynamic>? get _branch {
    final rows = widget.merchant['branches'] as List? ?? const [];
    if (rows.isEmpty || rows.first is! Map) return null;
    return (rows.first as Map).cast<String, dynamic>();
  }

  bool get _pickupEnabled => _branch?['pickupEnabled'] == true;
  bool get _deliveryEnabled => _branch?['deliveryEnabled'] == true;
  bool get _isDelivery => _fulfillment == 'DELIVERY';
  String get _currency => widget.merchant['currency']?.toString() ?? 'RWF';
  double get _subtotal => widget.cartLines.fold(0, (sum, line) => sum + line.lineTotal);
  double get _discount => asDouble(widget.promoEstimate?['discount']);
  double get _estimatedTotal => (_subtotal + (_isDelivery ? (_deliveryPrice ?? 0) : 0) - _discount).clamp(0, double.infinity);

  @override
  void initState() {
    super.initState();
    if (!_deliveryEnabled && _pickupEnabled) _fulfillment = 'PICKUP';
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
      Map<String, dynamic>? selected;
      for (final row in rows) {
        if (row['isDefault'] == true) {
          selected = row;
          break;
        }
      }
      selected ??= rows.isNotEmpty ? rows.first : null;
      setState(() {
        _addresses = rows;
        _addressId = selected?['id']?.toString();
        _newAddress = rows.isEmpty;
      });
      if (_isDelivery && selected != null) await _refreshQuote();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _setFulfillment(String value) async {
    if (value == 'PICKUP' && !_pickupEnabled) return;
    if (value == 'DELIVERY' && !_deliveryEnabled) return;
    setState(() {
      _fulfillment = value;
      _error = null;
      if (value == 'PICKUP') {
        _deliveryPrice = 0;
        _distanceKm = null;
      }
    });
    if (value == 'DELIVERY') await _refreshQuote();
  }

  Future<void> _refreshQuote() async {
    if (!_isDelivery || _branch == null) return;
    setState(() {
      _quoteLoading = true;
      _error = null;
      _deliveryPrice = null;
      _distanceKm = null;
    });
    try {
      Map<String, dynamic> quote;
      if (_newAddress) {
        if (_latitude == null || _longitude == null) return;
        quote = await widget.api.deliveryQuoteForLocation(
          branchId: _branch!['id'].toString(),
          latitude: _latitude!,
          longitude: _longitude!,
        );
      } else {
        if (_addressId == null) return;
        quote = await widget.api.deliveryQuote(branchId: _branch!['id'].toString(), addressId: _addressId!);
      }
      if (!mounted) return;
      setState(() {
        _deliveryPrice = asDouble(quote['deliveryPrice']);
        _distanceKm = asDouble(quote['distanceKm']);
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _quoteLoading = false);
    }
  }

  Future<void> _useCurrentLocation() async {
    setState(() {
      _locating = true;
      _error = null;
    });
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        setState(() => _error = 'Turn on location services to calculate delivery.');
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        setState(() => _error = 'Location permission is required to calculate delivery distance.');
        return;
      }
      final position = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high));
      if (!mounted) return;
      setState(() {
        _latitude = position.latitude;
        _longitude = position.longitude;
      });
      await _refreshQuote();
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not get your current location.');
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _placeOrder() async {
    final branch = _branch;
    if (branch == null) {
      setState(() => _error = 'This merchant has no branch accepting orders.');
      return;
    }
    if (_isDelivery && _deliveryPrice == null) {
      setState(() => _error = 'Choose a deliverable location before placing the order.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      String? addressId;
      if (_isDelivery) {
        addressId = _addressId;
        if (_newAddress) {
          if (_addressLine.text.trim().isEmpty) {
            setState(() => _error = 'Enter the street, building or landmark for the delivery.');
            return;
          }
          if (_latitude == null || _longitude == null) {
            setState(() => _error = 'Use your current location so the merchant can price and deliver the order.');
            return;
          }
          final saved = await widget.api.addAddress(
            addressLine: _addressLine.text.trim(),
            city: _city.text.trim().isEmpty ? null : _city.text.trim(),
            instructions: _instructions.text.trim().isEmpty ? null : _instructions.text.trim(),
            latitude: _latitude,
            longitude: _longitude,
            isDefault: _addresses.isEmpty,
          );
          addressId = saved['id'].toString();
        }
        if (addressId == null) {
          setState(() => _error = 'Select a delivery address.');
          return;
        }
      }

      final order = await widget.api.createOrder(
        tenantId: widget.merchant['id'].toString(),
        branchId: branch['id'].toString(),
        items: widget.cartLines.map((line) => line.toOrderItem()).toList(),
        paymentMethod: 'CASH',
        fulfillmentType: _fulfillment,
        addressId: addressId,
        deliveryInstructions: _isDelivery && _newAddress && _instructions.text.trim().isNotEmpty ? _instructions.text.trim() : null,
        promoCode: widget.promoCode,
      );
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          icon: const Icon(Icons.check_circle_rounded, size: 54),
          title: const Text('Order placed', style: TextStyle(fontWeight: FontWeight.w900)),
          content: Text(
            'Order ${order['orderNumber']} was sent to ${widget.merchant['name']}.\n\n${_isDelivery ? 'Delivery' : 'Pickup'} · ${money(order['total'], currency: _currency)}',
            textAlign: TextAlign.center,
          ),
          actions: [FilledButton(onPressed: () => Navigator.pop(context), child: const Text('Done'))],
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
    final branch = _branch;
    final submitEnabled = !_loading && !_submitting && (!_isDelivery || _deliveryPrice != null);
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout', style: TextStyle(fontWeight: FontWeight.w900))),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 135),
              children: [
                const Text('Delivery options', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    if (_deliveryEnabled)
                      Expanded(
                        child: _FulfillmentCard(
                          icon: Icons.delivery_dining_rounded,
                          title: 'Delivery',
                          subtitle: _quoteLoading ? 'Calculating…' : _deliveryPrice == null ? 'Choose address' : _deliveryPrice == 0 ? 'Free' : money(_deliveryPrice!, currency: _currency),
                          selected: _fulfillment == 'DELIVERY',
                          onTap: () => _setFulfillment('DELIVERY'),
                        ),
                      ),
                    if (_deliveryEnabled && _pickupEnabled) const SizedBox(width: 10),
                    if (_pickupEnabled)
                      Expanded(
                        child: _FulfillmentCard(
                          icon: Icons.directions_walk_rounded,
                          title: 'Pickup',
                          subtitle: 'Free',
                          selected: _fulfillment == 'PICKUP',
                          onTap: () => _setFulfillment('PICKUP'),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 28),
                if (_isDelivery) ...[
                  const Text('Delivery location', style: TextStyle(fontSize: 25, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 6),
                  Text(_distanceKm == null ? 'Choose where you want this order delivered.' : '${_distanceKm!.toStringAsFixed(1)} km from ${branch?['name'] ?? 'the branch'}', style: const TextStyle(color: Colors.black54)),
                  const SizedBox(height: 14),
                  if (_addresses.isNotEmpty)
                    SegmentedButton<bool>(
                      segments: const [ButtonSegment(value: false, label: Text('Saved')), ButtonSegment(value: true, label: Text('New address'))],
                      selected: {_newAddress},
                      onSelectionChanged: (selection) async {
                        setState(() {
                          _newAddress = selection.first;
                          _deliveryPrice = null;
                          _distanceKm = null;
                          _error = null;
                        });
                        await _refreshQuote();
                      },
                    ),
                  const SizedBox(height: 14),
                  if (!_newAddress)
                    ..._addresses.map(
                      (address) => Container(
                        margin: const EdgeInsets.only(bottom: 9),
                        decoration: BoxDecoration(border: Border.all(color: _addressId == address['id'].toString() ? Colors.black : const Color(0xFFE7E7E7)), borderRadius: BorderRadius.circular(16)),
                        child: RadioListTile<String>(
                          value: address['id'].toString(),
                          groupValue: _addressId,
                          onChanged: (value) async {
                            setState(() {
                              _addressId = value;
                              _deliveryPrice = null;
                              _distanceKm = null;
                            });
                            await _refreshQuote();
                          },
                          title: Text((address['label'] ?? address['addressLine']).toString(), style: const TextStyle(fontWeight: FontWeight.w800)),
                          subtitle: Text([address['addressLine'], address['city']].where((v) => v != null && '$v'.isNotEmpty).join(' · ')),
                        ),
                      ),
                    )
                  else ...[
                    TextField(controller: _addressLine, decoration: const InputDecoration(labelText: 'Street / building / landmark', prefixIcon: Icon(Icons.location_on_outlined))),
                    const SizedBox(height: 12),
                    TextField(controller: _city, decoration: const InputDecoration(labelText: 'City')),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: _locating ? null : _useCurrentLocation,
                      icon: _locating ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : Icon(_latitude == null ? Icons.my_location_rounded : Icons.check_circle_rounded),
                      label: Padding(padding: const EdgeInsets.symmetric(vertical: 13), child: Text(_latitude == null ? 'Use my current location' : 'Precise location added')),
                    ),
                    const SizedBox(height: 12),
                    TextField(controller: _instructions, maxLines: 2, decoration: const InputDecoration(labelText: 'Delivery instructions (optional)')),
                  ],
                ] else ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: const Color(0xFFF4F4F4), borderRadius: BorderRadius.circular(16)),
                    child: Row(
                      children: [
                        const Icon(Icons.storefront_rounded),
                        const SizedBox(width: 12),
                        Expanded(child: Text([branch?['name'], branch?['addressLine'], branch?['city']].where((v) => v != null && '$v'.isNotEmpty).join(' · '), style: const TextStyle(fontWeight: FontWeight.w700))),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 28),
                const Text('Payment', style: TextStyle(fontSize: 25, fontWeight: FontWeight.w900)),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  decoration: BoxDecoration(color: const Color(0xFFF4F4F4), borderRadius: BorderRadius.circular(16)),
                  child: const ListTile(leading: Icon(Icons.payments_outlined), title: Text('Cash', style: TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('Pay when your order arrives'), trailing: Icon(Icons.check_circle_rounded)),
                ),
                const SizedBox(height: 28),
                const Text('Order summary', style: TextStyle(fontSize: 25, fontWeight: FontWeight.w900)),
                const SizedBox(height: 10),
                for (final line in widget.cartLines)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(line.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text([if (line.modifierSummary.isNotEmpty) line.modifierSummary, '${line.quantity} × ${money(line.unitPrice, currency: _currency)}'].join('\n')),
                    trailing: Text(money(line.lineTotal, currency: _currency)),
                  ),
                const Divider(),
                _PriceRow(label: 'Subtotal', value: money(_subtotal, currency: _currency)),
                if (_discount > 0) _PriceRow(label: 'Promotion', value: '-${money(_discount, currency: _currency)}', green: true),
                _PriceRow(label: _isDelivery ? 'Delivery' : 'Pickup', value: _isDelivery ? (_deliveryPrice == null ? '—' : _deliveryPrice == 0 ? 'Free' : money(_deliveryPrice!, currency: _currency)) : 'Free'),
                const SizedBox(height: 5),
                _PriceRow(label: 'Estimated total', value: money(_estimatedTotal, currency: _currency), strong: true),
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontWeight: FontWeight.w700)),
                ],
              ],
            ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(20, 8, 20, 18),
        child: SizedBox(
          height: 58,
          child: FilledButton(
            onPressed: submitEnabled ? _placeOrder : null,
            child: _submitting
                ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text('Place order · ${money(_estimatedTotal, currency: _currency)}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
          ),
        ),
      ),
    );
  }
}

class _FulfillmentCard extends StatelessWidget {
  const _FulfillmentCard({required this.icon, required this.title, required this.subtitle, required this.selected, required this.onTap});
  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: selected ? Colors.white : const Color(0xFFF3F3F3), border: Border.all(color: selected ? Colors.black : Colors.transparent, width: 1.5), borderRadius: BorderRadius.circular(16)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(icon), const SizedBox(height: 12), Text(title, style: const TextStyle(fontWeight: FontWeight.w900)), Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.black54))]),
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
    final style = TextStyle(fontSize: strong ? 19 : 16.5, fontWeight: strong ? FontWeight.w900 : FontWeight.w500, color: green ? const Color(0xFF0E7A3D) : null);
    return Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(children: [Expanded(child: Text(label, style: style)), Text(value, style: style)]));
  }
}
