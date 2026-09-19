import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../models/cart_line.dart';
import '../ui/format.dart';
import 'cart_screen.dart';

class MerchantScreen extends StatefulWidget {
  const MerchantScreen({super.key, required this.api, required this.slug});

  final ApiClient api;
  final String slug;

  @override
  State<MerchantScreen> createState() => _MerchantScreenState();
}

class _MerchantScreenState extends State<MerchantScreen> {
  Map<String, dynamic>? _merchant;
  final List<CartLine> _cart = [];
  bool _loading = true;
  String? _error;
  String? _selectedCategory;

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
      if (!mounted) return;
      final categories = merchant['categories'] as List? ?? const [];
      setState(() {
        _merchant = merchant;
        _selectedCategory ??= categories.isEmpty ? null : (categories.first as Map)['id']?.toString();
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Unable to load this merchant.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  int get _cartCount => _cart.fold(0, (sum, line) => sum + line.quantity);
  double get _subtotal => _cart.fold(0, (sum, line) => sum + line.lineTotal);

  Future<void> _configureProduct(Map<String, dynamic> product) async {
    final merchant = _merchant;
    if (merchant == null) return;
    final line = await showModalBottomSheet<CartLine>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => _ProductConfigurator(
        product: product,
        currency: merchant['currency']?.toString() ?? 'RWF',
      ),
    );
    if (line == null || !mounted) return;
    setState(() {
      final existing = _cart.where((item) => item.signature == line.signature).firstOrNull;
      if (existing == null) {
        _cart.add(line);
      } else {
        existing.quantity = (existing.quantity + line.quantity).clamp(1, 50);
      }
    });
  }

  Future<void> _openCart() async {
    final merchant = _merchant;
    if (merchant == null || _cart.isEmpty) return;
    final placed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => CartScreen(api: widget.api, merchant: merchant, lines: _cart)),
    );
    if (!mounted) return;
    setState(() {
      if (placed == true) _cart.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _merchant == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_error != null && _merchant == null) {
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
                Text(_error!, textAlign: TextAlign.center),
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
    final categories = (merchant['categories'] as List? ?? const []).cast<dynamic>();
    final branches = merchant['branches'] as List? ?? const [];
    final branch = branches.isNotEmpty && branches.first is Map ? (branches.first as Map).cast<String, dynamic>() : <String, dynamic>{};
    final pickupEnabled = branch['pickupEnabled'] == true;
    final deliveryEnabled = branch['deliveryEnabled'] == true;
    final coverUrl = merchant['coverImageUrl']?.toString();
    final logoUrl = merchant['logoUrl']?.toString();
    final selectedCategory = categories.cast<Map>().where((category) => category['id']?.toString() == _selectedCategory).firstOrNull;
    final visibleCategories = selectedCategory == null ? categories : [selectedCategory];

    return Scaffold(
      backgroundColor: Colors.white,
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Stack(
                children: [
                  _HeroImage(url: coverUrl),
                  SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
                      child: Row(
                        children: [
                          _CircleButton(icon: Icons.arrow_back_rounded, onTap: () => Navigator.pop(context)),
                          const Spacer(),
                          _CircleButton(icon: Icons.search_rounded, onTap: () {}),
                          const SizedBox(width: 10),
                          _CircleButton(icon: Icons.favorite_border_rounded, onTap: () {}),
                          const SizedBox(width: 10),
                          _CircleButton(icon: Icons.more_horiz_rounded, onTap: () {}),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SliverToBoxAdapter(
              child: Transform.translate(
                offset: const Offset(0, -22),
                child: Container(
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
                  ),
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _Logo(url: logoUrl),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  merchant['name'].toString(),
                                  style: const TextStyle(fontSize: 31, fontWeight: FontWeight.w900, letterSpacing: -1.2, height: 1.05),
                                ),
                                const SizedBox(height: 5),
                                Text(
                                  _merchantSummary(merchant, branch),
                                  style: const TextStyle(fontSize: 15.5, color: Colors.black87),
                                ),
                                if ((branch['addressLine'] ?? '').toString().isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      const Icon(Icons.location_on_outlined, size: 17, color: Colors.black54),
                                      const SizedBox(width: 4),
                                      Expanded(child: Text(branch['addressLine'].toString(), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.black54))),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          if (deliveryEnabled)
                            const Expanded(child: _ModeButton(icon: Icons.delivery_dining_rounded, label: 'Delivery', selected: true)),
                          if (deliveryEnabled && pickupEnabled) const SizedBox(width: 8),
                          if (pickupEnabled)
                            const Expanded(child: _ModeButton(icon: Icons.directions_walk_rounded, label: 'Pickup', selected: false)),
                          const SizedBox(width: 10),
                          const _GroupButton(),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Container(
                        decoration: BoxDecoration(border: Border.all(color: const Color(0xFFE9E9E9)), borderRadius: BorderRadius.circular(15)),
                        child: Row(
                          children: [
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                child: Column(
                                  children: [
                                    Text(_deliveryFeeLabel(branch, currency), style: const TextStyle(fontWeight: FontWeight.w900)),
                                    const SizedBox(height: 3),
                                    const Text('Delivery fee', style: TextStyle(color: Colors.black54)),
                                  ],
                                ),
                              ),
                            ),
                            Container(width: 1, height: 44, color: const Color(0xFFEAEAEA)),
                            const Expanded(
                              child: Padding(
                                padding: EdgeInsets.symmetric(vertical: 16),
                                child: Column(
                                  children: [
                                    Text('20–35 min', style: TextStyle(fontWeight: FontWeight.w900)),
                                    SizedBox(height: 3),
                                    Text('Estimated arrival', style: TextStyle(color: Colors.black54)),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      const Text('Explore menu', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, letterSpacing: -.7)),
                      const SizedBox(height: 12),
                      SizedBox(
                        height: 42,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          children: [
                            _CategoryChip(
                              label: 'Featured',
                              selected: _selectedCategory == null,
                              onTap: () => setState(() => _selectedCategory = null),
                            ),
                            for (final raw in categories)
                              _CategoryChip(
                                label: (raw as Map)['name'].toString(),
                                selected: _selectedCategory == raw['id']?.toString(),
                                onTap: () => setState(() => _selectedCategory = raw['id']?.toString()),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                  ),
                ),
              ),
            ),
            if (categories.isEmpty)
              const SliverFillRemaining(hasScrollBody: false, child: Center(child: Text('No products are available yet.')))
            else
              for (final rawCategory in visibleCategories) ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 10, 20, 12),
                    child: Text(
                      (rawCategory as Map)['name'].toString(),
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900),
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 22,
                      crossAxisSpacing: 12,
                      childAspectRatio: .68,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final products = (rawCategory['products'] as List? ?? const []);
                        final product = (products[index] as Map).cast<String, dynamic>();
                        return _ProductCard(product: product, currency: currency, onTap: () => _configureProduct(product));
                      },
                      childCount: (rawCategory['products'] as List? ?? const []).length,
                    ),
                  ),
                ),
              ],
            SliverToBoxAdapter(child: SizedBox(height: _cart.isEmpty ? 80 : 145)),
          ],
        ),
      ),
      bottomNavigationBar: _cart.isEmpty
          ? null
          : SafeArea(
              minimum: const EdgeInsets.fromLTRB(20, 8, 20, 18),
              child: SizedBox(
                height: 62,
                child: FilledButton(
                  onPressed: _openCart,
                  style: FilledButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(32))),
                  child: Row(
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: Colors.white.withValues(alpha: .18), shape: BoxShape.circle),
                        child: Text('$_cartCount', style: const TextStyle(fontWeight: FontWeight.w900)),
                      ),
                      const SizedBox(width: 12),
                      const Text('View cart', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                      const Spacer(),
                      Text(money(_subtotal, currency: currency), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
                    ],
                  ),
                ),
              ),
            ),
    );
  }

  String _merchantSummary(Map<String, dynamic> merchant, Map<String, dynamic> branch) {
    final type = merchant['merchantType'].toString().replaceAll('_', ' ').toLowerCase();
    final city = branch['city']?.toString();
    return [type, if (city != null && city.isNotEmpty) city].join(' · ');
  }

  String _deliveryFeeLabel(Map<String, dynamic> branch, String currency) {
    final zones = branch['deliveryZones'] as List? ?? const [];
    if (zones.any((zone) => zone is Map && asDouble(zone['fee']) == 0)) return 'Free nearby';
    if (zones.isEmpty) return 'At checkout';
    final fees = zones.whereType<Map>().map((zone) => asDouble(zone['fee'])).where((fee) => fee >= 0).toList();
    if (fees.isEmpty) return 'At checkout';
    fees.sort();
    return 'From ${money(fees.first, currency: currency)}';
  }
}

class _HeroImage extends StatelessWidget {
  const _HeroImage({required this.url});
  final String? url;

  @override
  Widget build(BuildContext context) {
    final value = url?.trim();
    if (value != null && value.isNotEmpty) {
      return Image.network(
        value,
        width: double.infinity,
        height: 280,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => const _HeroFallback(),
      );
    }
    return const _HeroFallback();
  }
}

class _HeroFallback extends StatelessWidget {
  const _HeroFallback();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 280,
      decoration: const BoxDecoration(
        gradient: LinearGradient(colors: [Color(0xFFF7D9AA), Color(0xFFDCE8C9)], begin: Alignment.topLeft, end: Alignment.bottomRight),
      ),
      child: const Center(child: Icon(Icons.restaurant_rounded, size: 95, color: Colors.black54)),
    );
  }
}

class _CircleButton extends StatelessWidget {
  const _CircleButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withValues(alpha: .74),
      shape: const CircleBorder(),
      child: InkWell(customBorder: const CircleBorder(), onTap: onTap, child: SizedBox(width: 48, height: 48, child: Icon(icon, color: Colors.white))),
    );
  }
}

class _Logo extends StatelessWidget {
  const _Logo({required this.url});
  final String? url;

  @override
  Widget build(BuildContext context) {
    final value = url?.trim();
    return Container(
      width: 72,
      height: 72,
      decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: const Color(0xFFEAEAEA)), color: Colors.white),
      clipBehavior: Clip.antiAlias,
      child: value == null || value.isEmpty
          ? const Icon(Icons.storefront_rounded)
          : Image.network(value, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.storefront_rounded)),
    );
  }
}

class _ModeButton extends StatelessWidget {
  const _ModeButton({required this.icon, required this.label, required this.selected});
  final IconData icon;
  final String label;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 66,
      decoration: BoxDecoration(
        color: selected ? Colors.white : const Color(0xFFF4F4F4),
        border: Border.all(color: selected ? const Color(0xFFD6D6D6) : Colors.transparent),
        borderRadius: BorderRadius.circular(18),
        boxShadow: selected ? const [BoxShadow(blurRadius: 8, color: Color(0x11000000), offset: Offset(0, 3))] : null,
      ),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(icon), const SizedBox(height: 2), Text(label, style: const TextStyle(fontWeight: FontWeight.w800))]),
    );
  }
}

class _GroupButton extends StatelessWidget {
  const _GroupButton();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 66,
      width: 82,
      decoration: BoxDecoration(color: const Color(0xFFF4F4F4), borderRadius: BorderRadius.circular(18)),
      child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.group_add_outlined), SizedBox(height: 2), Text('Group', style: TextStyle(fontWeight: FontWeight.w800))]),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onTap(),
        showCheckmark: false,
        selectedColor: Colors.black,
        backgroundColor: const Color(0xFFF1F1F1),
        labelStyle: TextStyle(color: selected ? Colors.white : Colors.black, fontWeight: FontWeight.w800),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22), side: BorderSide.none),
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product, required this.currency, required this.onTap});
  final Map<String, dynamic> product;
  final String currency;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final image = product['imageUrl']?.toString();
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: image == null || image.isEmpty
                      ? Container(color: const Color(0xFFF5F1EB), child: const Icon(Icons.fastfood_outlined, size: 48, color: Colors.black45))
                      : Image.network(image, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(color: const Color(0xFFF5F1EB), child: const Icon(Icons.fastfood_outlined, size: 48))),
                ),
                Positioned(
                  right: 8,
                  bottom: 8,
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle, boxShadow: [BoxShadow(blurRadius: 8, color: Color(0x22000000))]),
                    child: const Icon(Icons.add_rounded, size: 29),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(product['name'].toString(), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800)),
          const SizedBox(height: 3),
          Text(money(product['price'], currency: currency), style: const TextStyle(fontSize: 15.5)),
        ],
      ),
    );
  }
}

class _ProductConfigurator extends StatefulWidget {
  const _ProductConfigurator({required this.product, required this.currency});
  final Map<String, dynamic> product;
  final String currency;

  @override
  State<_ProductConfigurator> createState() => _ProductConfiguratorState();
}

class _ProductConfiguratorState extends State<_ProductConfigurator> {
  final Map<String, Set<String>> _selected = {};
  int _quantity = 1;
  String? _error;

  List<Map<String, dynamic>> get _groups => (widget.product['modifierGroups'] as List? ?? const [])
      .whereType<Map>()
      .map((item) => item.cast<String, dynamic>())
      .toList();

  List<CartModifierSelection> get _modifierSelections {
    final result = <CartModifierSelection>[];
    for (final group in _groups) {
      final groupId = group['id'].toString();
      final selectedIds = _selected[groupId] ?? const <String>{};
      final options = (group['options'] as List? ?? const []).whereType<Map>();
      for (final raw in options) {
        final option = raw.cast<String, dynamic>();
        if (!selectedIds.contains(option['id'].toString())) continue;
        result.add(
          CartModifierSelection(
            id: option['id'].toString(),
            groupId: groupId,
            groupName: group['name'].toString(),
            name: option['name'].toString(),
            priceDelta: asDouble(option['priceDelta']),
          ),
        );
      }
    }
    return result;
  }

  double get _unitPrice => asDouble(widget.product['price']) + _modifierSelections.fold(0, (sum, item) => sum + item.priceDelta);

  void _toggle(Map<String, dynamic> group, Map<String, dynamic> option) {
    final groupId = group['id'].toString();
    final optionId = option['id'].toString();
    final max = (group['maxSelections'] as num?)?.toInt() ?? 1;
    setState(() {
      final selected = _selected.putIfAbsent(groupId, () => <String>{});
      if (max == 1) {
        selected
          ..clear()
          ..add(optionId);
      } else if (selected.contains(optionId)) {
        selected.remove(optionId);
      } else if (selected.length < max) {
        selected.add(optionId);
      }
      _error = null;
    });
  }

  void _add() {
    for (final group in _groups) {
      final min = (group['minSelections'] as num?)?.toInt() ?? (group['isRequired'] == true ? 1 : 0);
      final selectedCount = _selected[group['id'].toString()]?.length ?? 0;
      if (selectedCount < min) {
        setState(() => _error = 'Choose ${group['name']} before adding this item.');
        return;
      }
    }

    Navigator.pop(
      context,
      CartLine(
        productId: widget.product['id'].toString(),
        name: widget.product['name'].toString(),
        description: widget.product['description']?.toString(),
        imageUrl: widget.product['imageUrl']?.toString(),
        basePrice: asDouble(widget.product['price']),
        quantity: _quantity,
        modifiers: _modifierSelections,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final image = widget.product['imageUrl']?.toString();
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: .9,
      minChildSize: .65,
      maxChildSize: .96,
      builder: (context, controller) {
        return Column(
          children: [
            Container(width: 42, height: 5, margin: const EdgeInsets.only(top: 9, bottom: 8), decoration: BoxDecoration(color: const Color(0xFFD0D0D0), borderRadius: BorderRadius.circular(9))),
            Expanded(
              child: ListView(
                controller: controller,
                padding: const EdgeInsets.only(bottom: 18),
                children: [
                  if (image != null && image.isNotEmpty)
                    Image.network(image, width: double.infinity, height: 250, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox.shrink()),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.product['name'].toString(), style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900, letterSpacing: -1)),
                        const SizedBox(height: 5),
                        Text(money(widget.product['price'], currency: widget.currency), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                        if ((widget.product['description'] ?? '').toString().isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text(widget.product['description'].toString(), style: const TextStyle(fontSize: 16, color: Colors.black54, height: 1.35)),
                        ],
                      ],
                    ),
                  ),
                  for (final group in _groups) _ModifierGroup(group: group, selected: _selected[group['id'].toString()] ?? const {}, currency: widget.currency, onTap: (option) => _toggle(group, option)),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                      child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontWeight: FontWeight.w700)),
                    ),
                ],
              ),
            ),
            SafeArea(
              top: false,
              minimum: const EdgeInsets.fromLTRB(20, 8, 20, 18),
              child: Row(
                children: [
                  Container(
                    height: 56,
                    decoration: BoxDecoration(color: const Color(0xFFF2F2F2), borderRadius: BorderRadius.circular(28)),
                    child: Row(
                      children: [
                        IconButton(onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null, icon: const Icon(Icons.remove_rounded)),
                        Text('$_quantity', style: const TextStyle(fontWeight: FontWeight.w900)),
                        IconButton(onPressed: _quantity < 50 ? () => setState(() => _quantity++) : null, icon: const Icon(Icons.add_rounded)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SizedBox(
                      height: 56,
                      child: FilledButton(
                        onPressed: _add,
                        child: Text('Add $_quantity to cart · ${money(_unitPrice * _quantity, currency: widget.currency)}', style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w900)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ModifierGroup extends StatelessWidget {
  const _ModifierGroup({required this.group, required this.selected, required this.currency, required this.onTap});
  final Map<String, dynamic> group;
  final Set<String> selected;
  final String currency;
  final ValueChanged<Map<String, dynamic>> onTap;

  @override
  Widget build(BuildContext context) {
    final options = (group['options'] as List? ?? const []).whereType<Map>().map((item) => item.cast<String, dynamic>()).toList();
    final min = (group['minSelections'] as num?)?.toInt() ?? (group['isRequired'] == true ? 1 : 0);
    final max = (group['maxSelections'] as num?)?.toInt() ?? 1;
    return Container(
      margin: const EdgeInsets.only(top: 22),
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),
      decoration: const BoxDecoration(border: Border(top: BorderSide(color: Color(0xFFF0F0F0), width: 8))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(group['name'].toString(), style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w900))),
              if (min > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(color: const Color(0xFFE8F5EC), borderRadius: BorderRadius.circular(8)),
                  child: const Text('Required', style: TextStyle(color: Color(0xFF0E7A3D), fontWeight: FontWeight.w800)),
                ),
            ],
          ),
          const SizedBox(height: 2),
          Text(max == 1 ? 'Choose 1' : 'Choose up to $max', style: const TextStyle(color: Colors.black54)),
          const SizedBox(height: 8),
          for (final option in options)
            ListTile(
              contentPadding: EdgeInsets.zero,
              onTap: () => onTap(option),
              title: Text(option['name'].toString(), style: const TextStyle(fontSize: 17)),
              subtitle: asDouble(option['priceDelta']) == 0 ? null : Text('+${money(option['priceDelta'], currency: currency)}'),
              trailing: max == 1
                  ? Radio<String>(value: option['id'].toString(), groupValue: selected.firstOrNull, onChanged: (_) => onTap(option))
                  : Checkbox(value: selected.contains(option['id'].toString()), onChanged: (_) => onTap(option)),
            ),
        ],
      ),
    );
  }
}
