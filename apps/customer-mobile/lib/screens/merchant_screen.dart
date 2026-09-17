import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../ui/format.dart';
import 'checkout_screen.dart';

class MerchantScreen extends StatefulWidget {
  const MerchantScreen({super.key, required this.api, required this.slug});

  final ApiClient api;
  final String slug;

  @override
  State<MerchantScreen> createState() => _MerchantScreenState();
}

class _MerchantScreenState extends State<MerchantScreen> {
  Map<String, dynamic>? _merchant;
  final Map<String, int> _cart = {};
  final Map<String, Map<String, dynamic>> _products = {};
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
      final merchant = await widget.api.merchant(widget.slug);
      final products = <String, Map<String, dynamic>>{};
      for (final rawCategory in merchant['categories'] as List? ?? const []) {
        final category = (rawCategory as Map).cast<String, dynamic>();
        for (final rawProduct in category['products'] as List? ?? const []) {
          final product = (rawProduct as Map).cast<String, dynamic>();
          products[product['id'].toString()] = product;
        }
      }
      if (!mounted) return;
      setState(() {
        _merchant = merchant;
        _products
          ..clear()
          ..addAll(products);
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Unable to load this merchant.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  int get _cartCount => _cart.values.fold(0, (sum, quantity) => sum + quantity);

  double get _subtotal {
    var amount = 0.0;
    for (final entry in _cart.entries) {
      amount += asDouble(_products[entry.key]?['price']) * entry.value;
    }
    return amount;
  }

  void _changeQuantity(String productId, int delta) {
    setState(() {
      final next = (_cart[productId] ?? 0) + delta;
      if (next <= 0) {
        _cart.remove(productId);
      } else if (next <= 50) {
        _cart[productId] = next;
      }
    });
  }

  Future<void> _checkout() async {
    final merchant = _merchant;
    if (merchant == null || _cart.isEmpty) return;
    final minimum = asDouble(merchant['minimumOrder']);
    if (_subtotal < minimum) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Minimum order is ${money(minimum, currency: merchant['currency']?.toString() ?? 'RWF')}.')),
      );
      return;
    }

    final placed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CheckoutScreen(
          api: widget.api,
          merchant: merchant,
          cart: Map.of(_cart),
          products: Map.of(_products),
        ),
      ),
    );
    if (placed == true && mounted) {
      setState(() => _cart.clear());
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Order sent to the merchant.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_error != null || _merchant == null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.store_mall_directory_outlined, size: 50),
                const SizedBox(height: 12),
                Text(_error ?? 'Merchant unavailable', textAlign: TextAlign.center),
                const SizedBox(height: 12),
                FilledButton(onPressed: _load, child: const Text('Retry')),
              ],
            ),
          ),
        ),
      );
    }

    final merchant = _merchant!;
    final currency = merchant['currency']?.toString() ?? 'RWF';
    final categories = merchant['categories'] as List? ?? const [];
    final branches = merchant['branches'] as List? ?? const [];
    final firstBranch = branches.isNotEmpty && branches.first is Map ? branches.first as Map : null;
    final pickupEnabled = firstBranch?['pickupEnabled'] == true;
    final deliveryEnabled = firstBranch?['deliveryEnabled'] == true;
    final zones = firstBranch?['deliveryZones'] as List? ?? const [];
    final hasFreeZone = zones.any((zone) => zone is Map && asDouble(zone['fee']) == 0);

    return Scaffold(
      appBar: AppBar(title: Text(merchant['name'].toString())),
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 18),
                child: Container(
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
                          const Icon(Icons.storefront_rounded, size: 42),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  merchant['name'].toString(),
                                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                                ),
                                Text(merchant['merchantType'].toString().replaceAll('_', ' ').toLowerCase()),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 14,
                        runSpacing: 8,
                        children: [
                          if (pickupEnabled)
                            const _Info(icon: Icons.shopping_bag_outlined, text: 'Pickup'),
                          if (deliveryEnabled)
                            _Info(
                              icon: Icons.delivery_dining_rounded,
                              text: hasFreeZone ? 'Free delivery nearby' : 'Delivery by distance',
                            ),
                          if (asDouble(merchant['minimumOrder']) > 0)
                            _Info(icon: Icons.receipt_long_outlined, text: 'Min ${money(merchant['minimumOrder'], currency: currency)}'),
                          if (firstBranch != null)
                            _Info(icon: Icons.location_on_outlined, text: firstBranch['city']?.toString() ?? firstBranch['name'].toString()),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (categories.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: Text('No products are available yet.')),
              )
            else
              for (final rawCategory in categories) ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                    child: Text(
                      (rawCategory as Map)['name'].toString(),
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverList.separated(
                    itemCount: ((rawCategory as Map)['products'] as List? ?? const []).length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final product = (((rawCategory)['products'] as List)[index] as Map).cast<String, dynamic>();
                      final id = product['id'].toString();
                      final quantity = _cart[id] ?? 0;
                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(
                            children: [
                              Container(
                                width: 58,
                                height: 58,
                                decoration: BoxDecoration(
                                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: const Icon(Icons.fastfood_outlined),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(product['name'].toString(), style: const TextStyle(fontWeight: FontWeight.w700)),
                                    if ((product['description'] ?? '').toString().isNotEmpty) ...[
                                      const SizedBox(height: 3),
                                      Text(product['description'].toString(), maxLines: 2, overflow: TextOverflow.ellipsis),
                                    ],
                                    const SizedBox(height: 5),
                                    Text(money(product['price'], currency: currency), style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.w800)),
                                  ],
                                ),
                              ),
                              if (quantity == 0)
                                IconButton.filledTonal(
                                  onPressed: () => _changeQuantity(id, 1),
                                  icon: const Icon(Icons.add_rounded),
                                )
                              else
                                Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(onPressed: () => _changeQuantity(id, -1), icon: const Icon(Icons.remove_circle_outline)),
                                    Text('$quantity', style: const TextStyle(fontWeight: FontWeight.w800)),
                                    IconButton(onPressed: () => _changeQuantity(id, 1), icon: const Icon(Icons.add_circle_outline)),
                                  ],
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            const SliverToBoxAdapter(child: SizedBox(height: 110)),
          ],
        ),
      ),
      bottomNavigationBar: _cart.isEmpty
          ? null
          : SafeArea(
              minimum: const EdgeInsets.all(16),
              child: FilledButton(
                onPressed: _checkout,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 14,
                        backgroundColor: Theme.of(context).colorScheme.onPrimary,
                        foregroundColor: Theme.of(context).colorScheme.primary,
                        child: Text('$_cartCount', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                      ),
                      const SizedBox(width: 12),
                      const Text('View cart', style: TextStyle(fontWeight: FontWeight.w800)),
                      const Spacer(),
                      Text(money(_subtotal, currency: currency), style: const TextStyle(fontWeight: FontWeight.w800)),
                    ],
                  ),
                ),
              ),
            ),
    );
  }
}

class _Info extends StatelessWidget {
  const _Info({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 18),
        const SizedBox(width: 5),
        Text(text),
      ],
    );
  }
}
