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
  List<Map<String, dynamic>> _addresses = [];
  Map<String, dynamic>? _selectedAddress;
  bool _loading = true;
  String? _error;
  String? _type;
  String _query = '';
  bool _pickupOnly = false;
  bool _offersOnly = false;
  bool _nearbyOnly = false;
  bool _sortByDeliveryFee = false;

  static const _categories = <String, ({String label, IconData icon})>{
    'RESTAURANT': (label: 'Food', icon: Icons.restaurant_rounded),
    'SUPERMARKET': (label: 'Grocery', icon: Icons.shopping_basket_rounded),
    'PHARMACY': (label: 'Pharmacy', icon: Icons.local_pharmacy_rounded),
    'RETAIL': (label: 'Shops', icon: Icons.storefront_rounded),
  };

  @override
  void initState() {
    super.initState();
    _loadAddresses();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  String get _locationLabel {
    final address = _selectedAddress;
    if (address == null) return 'Kigali';
    for (final key in ['label', 'city', 'addressLine']) {
      final value = address[key]?.toString().trim();
      if (value != null && value.isNotEmpty) return value;
    }
    return 'Kigali';
  }

  String? get _selectedCity {
    final city = _selectedAddress?['city']?.toString().trim();
    if (city != null && city.isNotEmpty) return city;
    return _selectedAddress == null ? 'Kigali' : null;
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
        _selectedAddress = selected;
      });
      if (_nearbyOnly) await _load();
    } catch (_) {
      // The marketplace remains usable even if saved locations cannot be loaded.
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await widget.api.merchants(
        type: _type,
        city: _nearbyOnly ? _selectedCity : null,
      );
      if (!mounted) return;
      setState(() => _merchants = rows);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Unable to load merchants right now.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filteredMerchants {
    final query = _query.trim().toLowerCase();
    final rows = _merchants.where((merchant) {
      final branches = merchant['branches'] as List? ?? const [];
      if (_pickupOnly && !branches.any((branch) => branch is Map && branch['pickupEnabled'] == true)) return false;
      if (_offersOnly && _eligiblePromotions(merchant).isEmpty) return false;
      if (query.isEmpty) return true;
      final searchable = <Object?>[
        merchant['name'],
        merchant['merchantType'],
        for (final promo in _eligiblePromotions(merchant)) promo['code'],
        for (final branch in branches) ...[
          if (branch is Map) branch['name'],
          if (branch is Map) branch['city'],
        ],
      ].whereType<Object>().map((value) => value.toString()).join(' ').toLowerCase();
      return searchable.contains(query);
    }).toList();

    if (_sortByDeliveryFee) {
      rows.sort((a, b) => _merchantDeliveryFee(a).compareTo(_merchantDeliveryFee(b)));
    }
    return rows;
  }

  Future<void> _selectType(String? value) async {
    setState(() => _type = value);
    await _load();
  }

  Future<void> _toggleNearby() async {
    setState(() => _nearbyOnly = !_nearbyOnly);
    await _load();
  }

  Future<void> _selectLocation(Map<String, dynamic>? address) async {
    setState(() => _selectedAddress = address);
    if (_nearbyOnly) await _load();
  }

  Future<void> _showLocationPicker() async {
    if (_addresses.isEmpty) await _loadAddresses();
    if (!mounted) return;

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      useSafeArea: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Delivery location', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            const Text('Choose the area used for nearby merchant results.', style: TextStyle(color: Colors.black54)),
            const SizedBox(height: 14),
            _LocationTile(
              title: 'Kigali',
              subtitle: 'Browse all available merchants in Kigali',
              selected: _selectedAddress == null,
              onTap: () {
                Navigator.pop(sheetContext);
                _selectLocation(null);
              },
            ),
            for (final address in _addresses)
              _LocationTile(
                title: (address['label']?.toString().trim().isNotEmpty ?? false)
                    ? address['label'].toString()
                    : (address['city']?.toString().trim().isNotEmpty ?? false)
                        ? address['city'].toString()
                        : address['addressLine']?.toString() ?? 'Saved address',
                subtitle: address['addressLine']?.toString() ?? address['city']?.toString() ?? '',
                selected: address['id'] != null && address['id'] == _selectedAddress?['id'],
                onTap: () {
                  Navigator.pop(sheetContext);
                  _selectLocation(address);
                },
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _showNotifications() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => const Padding(
        padding: EdgeInsets.fromLTRB(28, 8, 28, 36),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircleAvatar(
              radius: 30,
              backgroundColor: Color(0xFFF1F1F1),
              child: Icon(Icons.notifications_none_rounded, size: 30, color: Colors.black),
            ),
            SizedBox(height: 16),
            Text('You’re all caught up', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
            SizedBox(height: 7),
            Text(
              'Order updates and marketplace announcements will appear here.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.black54, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }

  void _openMerchant(Map<String, dynamic> merchant) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => MerchantScreen(api: widget.api, slug: merchant['slug'].toString())),
    );
  }

  @override
  Widget build(BuildContext context) {
    final merchants = _filteredMerchants;
    final featured = [...merchants]
      ..sort((a, b) => _eligiblePromotions(b).length.compareTo(_eligiblePromotions(a).length));
    final featuredRows = featured.take(8).toList();

    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([_load(), _loadAddresses()]);
      },
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: _showLocationPicker,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 4),
                              child: Row(
                                children: [
                                  const Icon(Icons.location_on_rounded, size: 21),
                                  const SizedBox(width: 6),
                                  Flexible(
                                    child: Text(
                                      _locationLabel,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                                    ),
                                  ),
                                  const SizedBox(width: 2),
                                  const Icon(Icons.keyboard_arrow_down_rounded, size: 22),
                                ],
                              ),
                            ),
                          ),
                        ),
                        IconButton(
                          tooltip: 'Notifications',
                          onPressed: _showNotifications,
                          icon: const Icon(Icons.notifications_none_rounded, size: 27),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        _ModeTab(
                          icon: Icons.delivery_dining_rounded,
                          label: 'Delivery',
                          selected: !_pickupOnly,
                          onTap: () => setState(() => _pickupOnly = false),
                        ),
                        const SizedBox(width: 24),
                        _ModeTab(
                          icon: Icons.shopping_bag_outlined,
                          label: 'Pickup',
                          selected: _pickupOnly,
                          onTap: () => setState(() => _pickupOnly = true),
                        ),
                      ],
                    ),
                    const SizedBox(height: 15),
                    TextField(
                      controller: _search,
                      onChanged: (value) => setState(() => _query = value),
                      textInputAction: TextInputAction.search,
                      decoration: InputDecoration(
                        hintText: 'Search food, groceries and stores',
                        prefixIcon: const Icon(Icons.search_rounded, size: 25),
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
                      height: 86,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          _CategoryButton(
                            label: 'All',
                            icon: Icons.apps_rounded,
                            selected: _type == null,
                            onTap: () => _selectType(null),
                          ),
                          for (final entry in _categories.entries)
                            _CategoryButton(
                              label: entry.value.label,
                              icon: entry.value.icon,
                              selected: _type == entry.key,
                              onTap: () => _selectType(entry.key),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 42,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          _FilterChip(
                            label: 'Offers',
                            icon: Icons.local_offer_outlined,
                            selected: _offersOnly,
                            onTap: () => setState(() => _offersOnly = !_offersOnly),
                          ),
                          if (!_pickupOnly)
                            _FilterChip(
                              label: 'Lowest fee',
                              icon: Icons.delivery_dining_outlined,
                              selected: _sortByDeliveryFee,
                              onTap: () => setState(() => _sortByDeliveryFee = !_sortByDeliveryFee),
                            ),
                          _FilterChip(
                            label: 'Nearby',
                            icon: Icons.near_me_outlined,
                            selected: _nearbyOnly,
                            onTap: _toggleNearby,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ),
          if (_loading)
            const SliverFillRemaining(hasScrollBody: false, child: Center(child: CircularProgressIndicator()))
          else if (_error != null)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.cloud_off_outlined, size: 48),
                      const SizedBox(height: 12),
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 14),
                      FilledButton(onPressed: _load, child: const Text('Retry')),
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
                  padding: const EdgeInsets.fromLTRB(28, 28, 28, 140),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.storefront_outlined, size: 52),
                      const SizedBox(height: 12),
                      Text(
                        _query.isEmpty ? 'No merchants are available for these filters yet.' : 'No merchants match “$_query”.',
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            )
          else ...[
            const SliverToBoxAdapter(child: _SectionHeader(title: 'Featured on Fida')),
            SliverToBoxAdapter(
              child: SizedBox(
                height: 232,
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  scrollDirection: Axis.horizontal,
                  itemCount: featuredRows.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 12),
                  itemBuilder: (context, index) => _FeaturedMerchantCard(
                    merchant: featuredRows[index],
                    onTap: () => _openMerchant(featuredRows[index]),
                  ),
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 22)),
            SliverToBoxAdapter(
              child: _SectionHeader(title: _pickupOnly ? 'Popular for pickup' : (_nearbyOnly ? 'Nearby merchants' : 'Popular near you')),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 160),
              sliver: SliverList.separated(
                itemCount: merchants.length,
                separatorBuilder: (_, __) => const SizedBox(height: 24),
                itemBuilder: (context, index) => _MerchantCard(
                  merchant: merchants[index],
                  onTap: () => _openMerchant(merchants[index]),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ModeTab extends StatelessWidget {
  const _ModeTab({required this.icon, required this.label, required this.selected, required this.onTap});

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
        child: Column(
          children: [
            Row(
              children: [
                Icon(icon, size: 21),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: selected ? FontWeight.w900 : FontWeight.w600,
                    color: selected ? Colors.black : Colors.black54,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 7),
            AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              width: selected ? 58 : 0,
              height: 3,
              decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(3)),
            ),
          ],
        ),
      ),
    );
  }
}

class _CategoryButton extends StatelessWidget {
  const _CategoryButton({required this.label, required this.icon, required this.selected, required this.onTap});

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 14),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: SizedBox(
          width: 64,
          child: Column(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 58,
                height: 54,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: selected ? Colors.black : const Color(0xFFF2F2F2),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, size: 27, color: selected ? Colors.white : Colors.black87),
              ),
              const SizedBox(height: 6),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12.5, fontWeight: selected ? FontWeight.w900 : FontWeight.w700),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.icon, required this.selected, required this.onTap});

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 9),
      child: ActionChip(
        onPressed: onTap,
        avatar: Icon(icon, size: 18, color: selected ? Colors.white : Colors.black),
        label: Text(label),
        labelStyle: TextStyle(fontWeight: FontWeight.w800, color: selected ? Colors.white : Colors.black),
        side: BorderSide.none,
        backgroundColor: selected ? Colors.black : const Color(0xFFF1F1F1),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 13),
      child: Text(title, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: -.75)),
    );
  }
}

class _FeaturedMerchantCard extends StatelessWidget {
  const _FeaturedMerchantCard({required this.merchant, required this.onTap});

  final Map<String, dynamic> merchant;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final branch = _firstBranch(merchant);
    return SizedBox(
      width: 286,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _MerchantImage(merchant: merchant, height: 150),
            const SizedBox(height: 9),
            Text(
              merchant['name'].toString(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 3),
            Text(
              _deliverySummary(branch, merchant),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.black54, fontSize: 13.5),
            ),
          ],
        ),
      ),
    );
  }
}

class _MerchantCard extends StatelessWidget {
  const _MerchantCard({required this.merchant, required this.onTap});

  final Map<String, dynamic> merchant;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final branch = _firstBranch(merchant);
    final location = [branch?['name'], branch?['city']]
        .where((value) => value != null && '$value'.trim().isNotEmpty)
        .join(' · ');
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _MerchantImage(merchant: merchant, height: 196),
          const SizedBox(height: 10),
          Text(
            merchant['name'].toString(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 2),
          Text(
            _deliverySummary(branch, merchant),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: Colors.black54),
          ),
          if (location.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(location, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.black45, fontSize: 13)),
          ],
        ],
      ),
    );
  }
}

class _MerchantImage extends StatelessWidget {
  const _MerchantImage({required this.merchant, required this.height});

  final Map<String, dynamic> merchant;
  final double height;

  @override
  Widget build(BuildContext context) {
    final cover = merchant['coverImageUrl']?.toString().trim();
    final promo = _promoLabel(merchant);

    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: Stack(
        children: [
          SizedBox(
            width: double.infinity,
            height: height,
            child: cover != null && cover.isNotEmpty
                ? Image.network(
                    cover,
                    width: double.infinity,
                    height: height,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => _FallbackMerchantImage(merchant: merchant, height: height),
                  )
                : _FallbackMerchantImage(merchant: merchant, height: height),
          ),
          if (promo != null)
            Positioned(
              left: 10,
              top: 10,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(20)),
                child: Text(promo, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w900)),
              ),
            ),
        ],
      ),
    );
  }
}

class _FallbackMerchantImage extends StatelessWidget {
  const _FallbackMerchantImage({required this.merchant, required this.height});

  final Map<String, dynamic> merchant;
  final double height;

  @override
  Widget build(BuildContext context) {
    final type = merchant['merchantType']?.toString();
    final icon = switch (type) {
      'RESTAURANT' => Icons.restaurant_rounded,
      'SUPERMARKET' => Icons.shopping_basket_rounded,
      'PHARMACY' => Icons.local_pharmacy_rounded,
      _ => Icons.storefront_rounded,
    };
    final logo = merchant['logoUrl']?.toString().trim();
    final name = merchant['name']?.toString().trim() ?? 'Fida';
    final initial = name.isEmpty ? 'F' : name.substring(0, 1).toUpperCase();

    return Container(
      width: double.infinity,
      height: height,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFFF3E8D8), Color(0xFFE1EAE4)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      alignment: Alignment.center,
      child: logo != null && logo.isNotEmpty
          ? Container(
              width: 78,
              height: 78,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22)),
              child: Image.network(
                logo,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => Center(child: Text(initial, style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w900))),
              ),
            )
          : Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 68,
                  height: 68,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: .78), borderRadius: BorderRadius.circular(20)),
                  child: Icon(icon, size: 34, color: Colors.black87),
                ),
                const SizedBox(height: 9),
                Text(initial, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.black54)),
              ],
            ),
    );
  }
}

class _LocationTile extends StatelessWidget {
  const _LocationTile({required this.title, required this.subtitle, required this.selected, required this.onTap});

  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      onTap: onTap,
      leading: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: const Color(0xFFF1F1F1), borderRadius: BorderRadius.circular(12)),
        child: const Icon(Icons.location_on_outlined),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
      subtitle: subtitle.isEmpty ? null : Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis),
      trailing: selected ? const Icon(Icons.check_circle_rounded) : const Icon(Icons.chevron_right_rounded),
    );
  }
}

Map<String, dynamic>? _firstBranch(Map<String, dynamic> merchant) {
  final branches = merchant['branches'] as List? ?? const [];
  if (branches.isEmpty || branches.first is! Map) return null;
  return (branches.first as Map).cast<String, dynamic>();
}

List<Map<String, dynamic>> _eligiblePromotions(Map<String, dynamic> merchant) {
  final rows = merchant['promotions'] as List? ?? const [];
  return rows.whereType<Map>().map((row) => row.cast<String, dynamic>()).where((promo) {
    final limit = promo['usageLimit'];
    if (limit == null) return true;
    return asDouble(promo['usageCount']) < asDouble(limit);
  }).toList();
}

String? _promoLabel(Map<String, dynamic> merchant) {
  final promos = _eligiblePromotions(merchant);
  if (promos.isEmpty) return null;
  final promo = promos.first;
  final type = promo['type']?.toString();
  final value = asDouble(promo['value']);
  final code = promo['code']?.toString().trim();
  final currency = merchant['currency']?.toString() ?? 'RWF';
  final discount = type == 'PERCENTAGE' ? '${value.round()}% off' : '${money(value, currency: currency)} off';
  return code != null && code.isNotEmpty ? '$discount · $code' : discount;
}

double _merchantDeliveryFee(Map<String, dynamic> merchant) {
  final branches = merchant['branches'] as List? ?? const [];
  final fees = <double>[];
  for (final branch in branches) {
    if (branch is! Map || branch['deliveryEnabled'] != true) continue;
    final zones = branch['deliveryZones'] as List? ?? const [];
    for (final zone in zones) {
      if (zone is Map) fees.add(asDouble(zone['fee']));
    }
  }
  if (fees.isNotEmpty) {
    fees.sort();
    return fees.first;
  }
  return asDouble(merchant['defaultDeliveryFee']);
}

String _deliverySummary(Map<String, dynamic>? branch, Map<String, dynamic> merchant) {
  if (branch == null) return merchant['merchantType']?.toString().replaceAll('_', ' ').toLowerCase() ?? 'Merchant';
  final pickup = branch['pickupEnabled'] == true;
  final delivery = branch['deliveryEnabled'] == true;
  if (delivery) {
    final fee = _merchantDeliveryFee(merchant);
    if (fee <= 0) return 'Free delivery · Delivery available';
    return '${money(fee, currency: merchant['currency']?.toString() ?? 'RWF')} delivery';
  }
  if (pickup) return 'Pickup available';
  return 'Open for orders';
}
