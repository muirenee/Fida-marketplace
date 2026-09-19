import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../ui/format.dart';
import 'merchant_screen.dart';

class MarketplaceScreen extends StatefulWidget {
  const MarketplaceScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<MarketplaceScreen> createState() => _MarketplaceScreenState();
}

class _MarketplaceScreenState extends State<MarketplaceScreen> {
  final _search = TextEditingController();
  List<Map<String, dynamic>> _merchants = [];
  bool _loading = true;
  String? _error;
  String? _type;
  String _query = '';

  static const _types = <String, ({String label, IconData icon})>{
    'RESTAURANT': (label: 'Restaurants', icon: Icons.restaurant_rounded),
    'SUPERMARKET': (label: 'Grocery', icon: Icons.shopping_basket_rounded),
    'PHARMACY': (label: 'Pharmacy', icon: Icons.local_pharmacy_rounded),
    'RETAIL': (label: 'Shops', icon: Icons.storefront_rounded),
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await widget.api.merchants(type: _type);
      if (!mounted) return;
      setState(() => _merchants = rows);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Unable to load merchants.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filteredMerchants {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return _merchants;
    return _merchants.where((merchant) {
      final branches = merchant['branches'] as List? ?? const [];
      final searchable =
          <Object?>[
                merchant['name'],
                merchant['merchantType'],
                for (final branch in branches) ...[
                  if (branch is Map) branch['name'],
                  if (branch is Map) branch['city'],
                ],
              ]
              .whereType<Object>()
              .map((value) => value.toString())
              .join(' ')
              .toLowerCase();
      return searchable.contains(query);
    }).toList();
  }

  Future<void> _selectType(String? value) async {
    setState(() => _type = value);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final merchants = _filteredMerchants;
    return RefreshIndicator(
      onRefresh: _load,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () {},
                            child: const Padding(
                              padding: EdgeInsets.symmetric(vertical: 4),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.location_on_rounded,
                                    color: Color(0xFF176B55),
                                  ),
                                  SizedBox(width: 7),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Order near you',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700,
                                            color: Colors.black54,
                                          ),
                                        ),
                                        Text(
                                          'Pickup or delivery',
                                          style: TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w900,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Icon(Icons.keyboard_arrow_down_rounded),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Container(
                          width: 42,
                          height: 42,
                          decoration: const BoxDecoration(
                            color: Color(0xFFF2F3F2),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.person_rounded),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    TextField(
                      controller: _search,
                      onChanged: (value) => setState(() => _query = value),
                      textInputAction: TextInputAction.search,
                      decoration: InputDecoration(
                        hintText: 'Search restaurants, grocery and shops',
                        prefixIcon: const Icon(Icons.search_rounded),
                        suffixIcon: _query.isEmpty
                            ? null
                            : IconButton(
                                onPressed: () {
                                  _search.clear();
                                  setState(() => _query = '');
                                },
                                icon: const Icon(Icons.close_rounded),
                              ),
                      ),
                    ),
                    const SizedBox(height: 18),
                    SizedBox(
                      height: 88,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          _CategoryButton(
                            label: 'All',
                            icon: Icons.grid_view_rounded,
                            selected: _type == null,
                            onTap: () => _selectType(null),
                          ),
                          for (final entry in _types.entries)
                            _CategoryButton(
                              label: entry.value.label,
                              icon: entry.value.icon,
                              selected: _type == entry.key,
                              onTap: () => _selectType(entry.key),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE8F4EF),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: const Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Local ordering, simplified',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                SizedBox(height: 4),
                                Text(
                                  'Choose pickup or merchant-priced delivery when you check out.',
                                ),
                              ],
                            ),
                          ),
                          SizedBox(width: 12),
                          Icon(
                            Icons.delivery_dining_rounded,
                            size: 42,
                            color: Color(0xFF176B55),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            _type == null
                                ? 'Popular near you'
                                : _types[_type]?.label ?? 'Merchants',
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(fontWeight: FontWeight.w900),
                          ),
                        ),
                        if (!_loading)
                          Text(
                            '${merchants.length} available',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: Colors.black54),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                  ],
                ),
              ),
            ),
          ),
          if (_loading)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.cloud_off_rounded, size: 48),
                      const SizedBox(height: 12),
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: _load,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else if (merchants.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    _query.isEmpty
                        ? 'No merchants are available in this category yet.'
                        : 'No merchants match “$_query”.',
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
              sliver: SliverList.separated(
                itemCount: merchants.length,
                separatorBuilder: (_, __) => const SizedBox(height: 22),
                itemBuilder: (context, index) => _MerchantCard(
                  merchant: merchants[index],
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => MerchantScreen(
                        api: widget.api,
                        slug: merchants[index]['slug'].toString(),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _CategoryButton extends StatelessWidget {
  const _CategoryButton({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: SizedBox(
          width: 74,
          child: Column(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: selected
                      ? const Color(0xFF111111)
                      : const Color(0xFFF2F3F2),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  icon,
                  color: selected ? Colors.white : Colors.black87,
                ),
              ),
              const SizedBox(height: 7),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: selected ? FontWeight.w900 : FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MerchantCard extends StatelessWidget {
  const _MerchantCard({required this.merchant, required this.onTap});

  final Map<String, dynamic> merchant;
  final VoidCallback onTap;

  IconData get _icon => switch (merchant['merchantType']) {
    'RESTAURANT' => Icons.restaurant_rounded,
    'SUPERMARKET' => Icons.shopping_basket_rounded,
    'PHARMACY' => Icons.local_pharmacy_rounded,
    _ => Icons.storefront_rounded,
  };

  @override
  Widget build(BuildContext context) {
    final branches = merchant['branches'] as List? ?? const [];
    final branch = branches.isNotEmpty && branches.first is Map
        ? branches.first as Map
        : null;
    final currency = (merchant['currency'] ?? 'RWF').toString();
    final minimum = asDouble(merchant['minimumOrder']);
    final pickupEnabled = branch?['pickupEnabled'] == true;
    final deliveryEnabled = branch?['deliveryEnabled'] == true;
    final zones = branch?['deliveryZones'] as List? ?? const [];
    final hasFreeZone = zones.any(
      (zone) => zone is Map && asDouble(zone['fee']) == 0,
    );
    final location = branch == null
        ? merchant['merchantType'].toString().replaceAll('_', ' ').toLowerCase()
        : [branch['name'], branch['city']]
              .where((value) => value != null && '$value'.trim().isNotEmpty)
              .join(' · ');

    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 150,
            width: double.infinity,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              gradient: const LinearGradient(
                colors: [Color(0xFFE8F4EF), Color(0xFFF3F1E8)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Center(
              child: Container(
                width: 82,
                height: 82,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .9),
                  shape: BoxShape.circle,
                ),
                child: Icon(_icon, size: 42, color: const Color(0xFF176B55)),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      merchant['name'].toString(),
                      style: Theme.of(context).textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      location.isEmpty ? 'Local merchant' : location,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium
                          ?.copyWith(color: Colors.black54),
                    ),
                    const SizedBox(height: 5),
                    Wrap(
                      spacing: 10,
                      runSpacing: 4,
                      children: [
                        if (pickupEnabled)
                          const _MetaText(
                            icon: Icons.shopping_bag_outlined,
                            text: 'Pickup',
                          ),
                        if (deliveryEnabled)
                          _MetaText(
                            icon: Icons.delivery_dining_rounded,
                            text: hasFreeZone
                                ? 'Free delivery nearby'
                                : 'Delivery by distance',
                          ),
                        if (minimum > 0)
                          _MetaText(
                            icon: Icons.receipt_long_outlined,
                            text:
                                'Min ${money(merchant['minimumOrder'], currency: currency)}',
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.chevron_right_rounded, color: Colors.black54),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetaText extends StatelessWidget {
  const _MetaText({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: Colors.black54),
        const SizedBox(width: 4),
        Text(
          text,
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}
