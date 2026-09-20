import 'dart:async';
import 'dart:math';

import 'package:fida_mobile_common/fida_mobile_common.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../core/api_client.dart';
import '../ui/format.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({
    super.key,
    required this.api,
    required this.merchant,
    required this.cart,
    required this.products,
    this.initialFulfillment = 'DELIVERY',
    this.orderNote = '',
  });

  final ApiClient api;
  final Map<String, dynamic> merchant;
  final String initialFulfillment, orderNote;
  final Map<String, int> cart;
  final Map<String, Map<String, dynamic>> products;

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  String _payment = 'CASH';
  List<String> _paymentMethods = ['CASH'];
  DateTime? _scheduledFor;
  final _promo = TextEditingController();
  final _checkoutKey = List.generate(
    24,
    (_) => Random.secure().nextInt(16).toRadixString(16),
  ).join();
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
  Map<String, dynamic>? _totals;
  String? _totalsError;
  bool _totalsLoading = false;
  int _totalsRequest = 0;
  Timer? _promoTimer;
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

  @override
  void initState() {
    super.initState();
    _fulfillment = widget.initialFulfillment;
    if (!_deliveryEnabled && _pickupEnabled) _fulfillment = 'PICKUP';
    _promo.addListener(() {
      _promoTimer?.cancel();
      _totalsRequest++;
      setState(() => _totals = null);
      _promoTimer = Timer(const Duration(milliseconds: 400), _refreshTotals);
    });
    _loadAddresses();
    _loadPaymentMethods();
  }

  @override
  void dispose() {
    _promoTimer?.cancel();
    _promo.dispose();
    _addressLine.dispose();
    _city.dispose();
    _instructions.dispose();
    super.dispose();
  }

  double get _subtotal {
    var value = 0.0;
    for (final entry in widget.cart.entries) {
      value += asDouble(widget.products[entry.key]?['price']) * entry.value;
    }
    return value;
  }

  Future<void> _refreshTotals() async {
    final generation = ++_totalsRequest;
    if (_branch == null || (_isDelivery && _deliveryPrice == null)) {
      if (mounted) setState(() { _totals = null; _totalsLoading = false; });
      return;
    }
    setState(() { _totalsLoading = true; _totalsError = null; _totals = null; });
    try {
      final result = await widget.api.request('POST', '/v1/customer/checkout-preview', body: {
        'tenantId': widget.merchant['id'], 'branchId': _branch!['id'],
        'fulfillmentType': _fulfillment, 'promoCode': _promo.text.trim(),
        if (!_newAddress) 'addressId': _addressId,
        if (_newAddress) 'latitude': _latitude,
        if (_newAddress) 'longitude': _longitude,
        'items': widget.cart.entries.map((e) => {
          'productId': widget.products[e.key]?['productId'] ?? e.key,
          'quantity': e.value, 'options': widget.products[e.key]?['selectedOptions'] ?? [],
        }).toList(),
      });
      if (mounted && generation == _totalsRequest) setState(() => _totals = Map<String, dynamic>.from(result));
    } catch (e) {
      if (mounted && generation == _totalsRequest) setState(() => _totalsError = e.toString());
    } finally {
      if (mounted && generation == _totalsRequest) setState(() => _totalsLoading = false);
    }
  }

  Future<void> _loadPaymentMethods() async {
    try {
      final result = await widget.api.request('GET', '/v1/payments/methods?tenantId=${widget.merchant['id']}');
      if (mounted)
        setState(
          () => _paymentMethods = (result['methods'] as List).cast<String>(),
        );
    } catch (_) {}
  }

  Future<void> _schedule() async {
    final now = DateTime.now();
    final day = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 7)),
    );
    if (day == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(now.add(const Duration(hours: 1))),
    );
    if (time == null || !mounted) return;
    setState(
      () => _scheduledFor = DateTime(
        day.year,
        day.month,
        day.day,
        time.hour,
        time.minute,
      ),
    );
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
      if (!_isDelivery) await _refreshTotals();
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
    else await _refreshTotals();
  }

  Future<void> _refreshQuote() async {
    if (!_isDelivery || _branch == null) return;
    setState(() {
      _totalsRequest++;
      _totals = null;
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
        quote = await widget.api.deliveryQuote(
          branchId: _branch!['id'].toString(),
          addressId: _addressId!,
        );
      }
      if (!mounted) return;
      setState(() {
        _deliveryPrice = asDouble(quote['deliveryPrice']);
        _distanceKm = asDouble(quote['distanceKm']);
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) { setState(() => _quoteLoading = false); await _refreshTotals(); }
    }
  }

  Future<void> _useCurrentLocation() async {
    setState(() {
      _locating = true;
      _error = null;
    });
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        setState(
          () => _error = 'Turn on location services to calculate delivery.',
        );
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied)
        permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        setState(
          () => _error =
              'Location permission is required to calculate delivery distance.',
        );
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      if (!mounted) return;
      setState(() {
        _latitude = position.latitude;
        _longitude = position.longitude;
      });
      await _refreshQuote();
    } catch (_) {
      if (mounted)
        setState(() => _error = 'Could not get your current location.');
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
      setState(
        () =>
            _error = 'Choose a deliverable location before placing the order.',
      );
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
            setState(
              () => _error =
                  'Enter the street, building or landmark for the delivery.',
            );
            return;
          }
          if (_latitude == null || _longitude == null) {
            setState(
              () => _error =
                  'Use your location so the merchant can price and deliver the order.',
            );
            return;
          }
          final saved = await widget.api.addAddress(
            addressLine: _addressLine.text.trim(),
            city: _city.text.trim().isEmpty ? null : _city.text.trim(),
            instructions: _instructions.text.trim().isEmpty
                ? null
                : _instructions.text.trim(),
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

      final totals = await widget.api.request(
        'POST',
        '/v1/customer/checkout-preview',
        body: {
          'tenantId': widget.merchant['id'],
          'branchId': branch['id'],
          'fulfillmentType': _fulfillment,
          'addressId': addressId,
          'items': widget.cart.entries
              .map(
                (e) => {
                  'productId': widget.products[e.key]?['productId'] ?? e.key,
                  'quantity': e.value,
                  'options': widget.products[e.key]?['selectedOptions'] ?? [],
                },
              )
              .toList(),
          'promoCode': _promo.text.trim(),
        },
      );
      if (!mounted) return;
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          title: const Text('Confirm your order'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Items: ${money(totals['subtotal'])}'),
              Text('Delivery: ${money(totals['deliveryFee'])}'),
              Text('Discount: −${money(totals['discount'])}'),
              Text('Tax: ${money(totals['tax'])}'),
              const Divider(),
              Text(
                'Total: ${money(totals['total'])}',
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 22,
                ),
              ),
              if (_scheduledFor != null)
                Text('Scheduled: ${_scheduledFor!.toLocal()}'),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Back'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Place order'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
      final order = await widget.api.createOrder(
        tenantId: widget.merchant['id'].toString(),
        branchId: branch['id'].toString(),
        items: widget.cart.entries
            .map(
              (entry) => {
                'productId':
                    widget.products[entry.key]?['productId'] ?? entry.key,
                'quantity': entry.value,
                'options': widget.products[entry.key]?['selectedOptions'] ?? [],
              },
            )
            .toList(),
        paymentMethod: _payment,
        promoCode: _promo.text.trim().isEmpty ? null : _promo.text.trim(),
        scheduledFor: _scheduledFor?.toUtc().toIso8601String(),
        checkoutKey: _checkoutKey,
        fulfillmentType: _fulfillment,
        addressId: addressId,
        confirmedTotal: asDouble(totals['total']),
        cookingInstructions: widget.orderNote,
        deliveryInstructions: [
          if (_isDelivery && _instructions.text.trim().isNotEmpty)
            _instructions.text.trim(),
        ].join(' '),
      );

      if (!mounted) return;
      if (_payment != 'CASH') {
        try {
          final payment = await widget.api.request(
            'POST',
            '/v1/customer/orders/${order['id']}/payment',
          );
          if (mounted)
            await openFidaLink(context, Uri.parse(payment['url'].toString()));
        } catch (_) {
          if (mounted)
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Order saved. Open Orders to retry payment.'),
              ),
            );
        }
      }
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          icon: const Icon(Icons.check_circle_rounded, size: 54),
          title: const Text('Order placed'),
          content: Text(
            'Order ${order['orderNumber']} was sent to ${widget.merchant['name']}.\n\n${_isDelivery ? 'Delivery' : 'Pickup'} · ${money(order['total'], currency: widget.merchant['currency']?.toString() ?? 'RWF')}',
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
    final branch = _branch;
    final submitEnabled =
        !_loading && !_submitting && (!_isDelivery || _deliveryPrice != null);

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Checkout',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
              children: [
                Text(
                  'How would you like it?',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _FulfillmentCard(
                        icon: Icons.shopping_bag_outlined,
                        title: 'Pickup',
                        subtitle: _pickupEnabled ? 'Free' : 'Not available',
                        selected: _fulfillment == 'PICKUP',
                        enabled: _pickupEnabled,
                        onTap: () => _setFulfillment('PICKUP'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _FulfillmentCard(
                        icon: Icons.delivery_dining_rounded,
                        title: 'Delivery',
                        subtitle: !_deliveryEnabled
                            ? 'Not available'
                            : _quoteLoading
                            ? 'Calculating…'
                            : _deliveryPrice == null
                            ? 'Price by distance'
                            : _deliveryPrice == 0
                            ? 'Free delivery'
                            : money(_deliveryPrice!, currency: currency),
                        selected: _fulfillment == 'DELIVERY',
                        enabled: _deliveryEnabled,
                        onTap: () => _setFulfillment('DELIVERY'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                if (_isDelivery) ...[
                  Text(
                    'Delivery location',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _distanceKm == null
                        ? 'The merchant sets the delivery price according to distance.'
                        : '${_distanceKm!.toStringAsFixed(1)} km from ${branch?['name'] ?? 'the branch'}',
                    style: Theme.of(
                      context,
                    ).textTheme.bodyMedium?.copyWith(color: Colors.black54),
                  ),
                  const SizedBox(height: 12),
                  if (_addresses.isNotEmpty)
                    SegmentedButton<bool>(
                      segments: const [
                        ButtonSegment(
                          value: false,
                          icon: Icon(Icons.bookmark_outline),
                          label: Text('Saved'),
                        ),
                        ButtonSegment(
                          value: true,
                          icon: Icon(Icons.add_location_alt_outlined),
                          label: Text('New'),
                        ),
                      ],
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
                      (address) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Card(
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
                            title: Text(
                              (address['label'] ?? address['addressLine'])
                                  .toString(),
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            subtitle: Text(
                              [
                                    address['addressLine'],
                                    address['city'],
                                    if (address['latitude'] == null ||
                                        address['longitude'] == null)
                                      'Location pin needed',
                                  ]
                                  .where((v) => v != null && '$v'.isNotEmpty)
                                  .join(' · '),
                            ),
                          ),
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
                      decoration: const InputDecoration(
                        labelText: 'City',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: _locating ? null : _useCurrentLocation,
                      icon: _locating
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Icon(
                              _latitude == null
                                  ? Icons.my_location_rounded
                                  : Icons.check_circle_rounded,
                            ),
                      label: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        child: Text(
                          _latitude == null
                              ? 'Use my current location'
                              : 'Precise location added',
                        ),
                      ),
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
                ] else ...[
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.storefront_rounded),
                      title: Text(
                        branch?['name']?.toString() ?? 'Pickup at merchant',
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: Text(
                        [branch?['addressLine'], branch?['city']]
                            .where((v) => v != null && '$v'.isNotEmpty)
                            .join(' · '),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 26),
                Text(
                  'Payment',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _payment,
                  decoration: const InputDecoration(
                    labelText: 'Payment method',
                  ),
                  items: _paymentMethods
                      .map(
                        (m) => DropdownMenuItem(
                          value: m,
                          child: Text(
                            m == 'CASH'
                                ? (_isDelivery
                                      ? 'Cash on delivery'
                                      : 'Cash at pickup')
                                : m == 'CARD'
                                ? 'Card'
                                : 'Mobile Money',
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => setState(() => _payment = v ?? 'CASH'),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _promo,
                  decoration: const InputDecoration(
                    labelText: 'Promo code (optional)',
                    prefixIcon: Icon(Icons.local_offer_outlined),
                  ),
                ),
                const SizedBox(height: 16),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.schedule_rounded),
                  title: Text(
                    _scheduledFor == null
                        ? 'As soon as possible'
                        : 'Scheduled: ${_scheduledFor!.toLocal()}',
                  ),
                  subtitle: const Text(
                    'You can schedule 30 minutes to 7 days ahead.',
                  ),
                  onTap: _schedule,
                  trailing: _scheduledFor == null
                      ? const Icon(Icons.chevron_right)
                      : IconButton(
                          onPressed: () => setState(() => _scheduledFor = null),
                          icon: const Icon(Icons.close),
                        ),
                ),
                const SizedBox(height: 26),
                Text(
                  'Your order',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 10),
                for (final entry in widget.cart.entries)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      widget.products[entry.key]?['name']?.toString() ??
                          'Product',
                    ),
                    subtitle: Text(
                      '${entry.value} × ${money(widget.products[entry.key]?['price'], currency: currency)}',
                    ),
                    trailing: Text(
                      money(
                        asDouble(widget.products[entry.key]?['price']) *
                            entry.value,
                        currency: currency,
                      ),
                    ),
                  ),
                const Divider(),
                _PriceLine(label: 'Subtotal', value: money(_totals?['subtotal'] ?? _subtotal, currency: currency)),
                _PriceLine(label: 'Delivery', value: _isDelivery && _deliveryPrice == null ? 'Choose address' : money(_totals?['deliveryFee'] ?? (_isDelivery ? _deliveryPrice : 0), currency: currency)),
                if (_totalsLoading) const LinearProgressIndicator(),
                if (_totalsError != null) Text(_totalsError!, style: const TextStyle(color: Colors.red)),
                if (_totals != null) ...[
                  _PriceLine(label: 'Item discounts', value: '- ${money(_totals!['itemDiscount'], currency: currency)}'),
                  _PriceLine(label: 'Promo discount', value: '- ${money(_totals!['cartDiscount'], currency: currency)}'),
                  _PriceLine(label: '${_totals!['taxLabel']} (${_totals!['taxPercent']}%)', value: money(_totals!['tax'], currency: currency)),
                  const Divider(),
                  _PriceLine(label: 'Total', value: money(_totals!['total'], currency: currency), strong: true),
                ] else if (!_totalsLoading) const Text('Choose a delivery location or pickup to calculate discounts and tax.'),
                if (_isDelivery && _deliveryPrice != null) ...[
                  const SizedBox(height: 5),
                  Text(
                    _deliveryPrice == 0
                        ? 'Free delivery for this location.'
                        : 'The selected delivery option includes ${money(_deliveryPrice!, currency: currency)} based on distance.',
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: Colors.black54),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 14),
                  Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ],
              ],
            ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.all(16),
        child: FilledButton.icon(
          onPressed: submitEnabled ? _placeOrder : null,
          icon: _submitting
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.shopping_bag_rounded),
          label: Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Text(
              _isDelivery && _deliveryPrice == null
                  ? 'Choose delivery location'
                  : 'Review order',
            ),
          ),
        ),
      ),
    );
  }
}

class _FulfillmentCard extends StatelessWidget {
  const _FulfillmentCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: enabled ? onTap : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? const Color(0xFF111111) : const Color(0xFFE3E4E3),
            width: selected ? 2 : 1,
          ),
          color: enabled ? Colors.white : const Color(0xFFF3F3F3),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: enabled ? Colors.black87 : Colors.black38),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 12,
                color: enabled ? Colors.black54 : Colors.black38,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PriceLine extends StatelessWidget {
  const _PriceLine({
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
        ? Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)
        : null;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(child: Text(label, style: style)),
          const SizedBox(width: 16),
          Flexible(child: Text(value, style: style, textAlign: TextAlign.right)),
        ],
      ),
    );
  }
}
