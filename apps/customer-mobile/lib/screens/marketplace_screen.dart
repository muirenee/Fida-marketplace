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
  bool _pickupOnly = false;

  static const _categories = <String, ({String label, IconData icon, String emoji})>{
    'RESTAURANT': (label: 'Food', icon: Icons.restaurant_rounded, emoji: '🍔'),
    'SUPERMARKET': (label: 'Grocery', icon: Icons.shopping_basket_rounded, emoji: '🛒'),
    'PHARMACY': (label: 'Pharmacy', icon: Icons.local_pharmacy_rounded, emoji: '💊'),
    'RETAIL': (label: 'Shops', icon: Icons.storefront_rounded, emoji: '🛍️'),
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
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Unable to load merchants right now.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filteredMerchants {
    final query = _query.trim().toLowerCase();
    return _merchants.where((merchant) {
      final branches = merchant['branches'] as List? ?? const [];
      if (_pickupOnly && !branches.any((branch) => branch is Map && branch['pickupEnabled'] == true)) return false;
      if (query.isEmpty) return true;
      final searchable = <Object?>[
        merchant['name'],
        merchant['merchantType'],
        for (final branch in branches) ...[
          if (branch is Map) branch['name'],
          if (branch is Map) branch['city'],
        ],
      ].whereType<Object>().map((value) => value.toString()).join(' ').toLowerCase();
      return searchable.contains(query);
    }).toList();
  }

  Future<void> _selectType(String? value) async {
    setState(() => _type = value);
    await _load();
  }

  void _openMerchant(Map<String, dynamic> merchant) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => MerchantScreen(api: widget.api, slug: merchant['slug'].toString())),
    );
  }

  @override
  Widget build(BuildContext context) {
    final merchants = _filteredMerchants;
    final featured = merchants.take(8).toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            borderRadius: BorderRadius.circular(10),
                            onTap: () {},
                            child: const Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    'Kigali',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                                  ),
                                ),
                                SizedBox(width: 4),
                                Icon(Icons.keyboard_arrow_down_rounded, size: 23),
                              ],
                            ),
                          ),
                        ),
                        IconButton(onPressed: () {}, icon: const Icon(Icons.notifications_none_rounded, size: 28)),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Row(
                      children: [
                        _ModeTab(icon: Icons.delivery_dining_rounded, label: 'Delivery', selected: !_pickupOnly, onTap: () => setState(() => _pickupOnly = false)),
                        const SizedBox(width: 24),
                        _ModeTab(icon: Icons.shopping_bag_outlined, label: 'Pickup', selected: _pickupOnly, onTap: () => setState(() => _pickupOnly = true)),
                      ],
                    ),
                    const SizedBox(height: 17),
                    TextField(
                      controller: _search,
                      onChanged: (value) => setState(() => _query = value),
                      textInputAction: TextInputAction.search,
                      decoration: InputDecoration(
                        hintText: 'Search Fida Marketplace',
                        prefixIcon: const Icon(Icons.search_rounded, size: 26),
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
                    const SizedBox(height: 22),
                    SizedBox(
                      height: 92,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          _CategoryButton(label: 'All', emoji: '✨', selected: _type == null, onTap: () => _selectType(null)),
                          for (final entry in _categories.entries)
                            _CategoryButton(label: entry.value.label, emoji: entry.value.emoji, selected: _type == entry.key, onTap: () => _selectType(entry.key)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      height: 44,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        children: [
                          _FilterChip(label: 'Offers', icon: Icons.local_offer_outlined, onTap: () {}),
                          _FilterChip(label: _pickupOnly ? 'Pickup' : 'Delivery fee', icon: _pickupOnly ? Icons.shopping_bag_outlined : Icons.delivery_dining_outlined, onTap: () {}),
                          _FilterChip(label: 'Nearby', icon: Icons.near_me_outlined, onTap: () {}),
                        ],
                      ),
                    ),
                    const SizedBox(height: 26),
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
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.storefront_outlined, size: 52),
                      const SizedBox(height: 12),
                      Text(
                        _query.isEmpty ? 'No merchants are available for this selection yet.' : 'No merchants match “$_query”.',
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            )
          else ...[
            SliverToBoxAdapter(
              child: _SectionHeader(title: 'Featured on Fida', onTap: () {}),
            ),
            SliverToBoxAdapter(
              child: SizedBox(
                height: 262,
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  scrollDirection: Axis.horizontal,
                  itemCount: featured.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 12),
                  itemBuilder: (context, index) => _FeaturedMerchantCard(merchant: featured[index], onTap: () => _openMerchant(featured[index])),
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 28)),
            SliverToBoxAdapter(child: _SectionHeader(title: _pickupOnly ? 'Popular for pickup' : 'Popular near you', onTap: () {})),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 120),
              sliver: SliverList.separated(
                itemCount: merchants.length,
                separatorBuilder: (_, __) => const SizedBox(height: 24),
                itemBuilder: (context, index) => _MerchantCard(merchant: merchants[index], onTap: () => _openMerchant(merchants[index])),
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
      onTap: onTap,
      child: Column(
        children: [
          Row(children: [Icon(icon, size: 21), const SizedBox(width: 6), Text(label, style: TextStyle(fontSize: 17, fontWeight: selected ? FontWeight.w900 : FontWeight.w600, color: selected ? Colors.black : Colors.black54))]),
          const SizedBox(height: 8),
          AnimatedContainer(duration: const Duration(milliseconds: 160), width: selected ? 58 : 0, height: 3, decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(3))),
        ],
      ),
    );
  }
}

class _CategoryButton extends StatelessWidget {
  const _CategoryButton({required this.label, required this.emoji, required this.selected, required this.onTap});
  final String label;
  final String emoji;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 18),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: SizedBox(
          width: 62,
          child: Column(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 58,
                height: 58,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: selected ? const Color(0xFFF0F0F0) : Colors.transparent, borderRadius: BorderRadius.circular(16)),
                child: Text(emoji, style: const TextStyle(fontSize: 36)),
              ),
              const SizedBox(height: 6),
              Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, fontWeight: selected ? FontWeight.w900 : FontWeight.w700)),
            ],
          ),
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.icon, required this.onTap});
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 9),
      child: ActionChip(
        onPressed: onTap,
        avatar: Icon(icon, size: 18),
        label: Text(label),
        labelStyle: const TextStyle(fontWeight: FontWeight.w700),
        side: BorderSide.none,
        backgroundColor: const Color(0xFFF1F1F1),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.onTap});
  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 14),
      child: Row(
        children: [
          Expanded(child: Text(title, style: const TextStyle(fontSize: 27, fontWeight: FontWeight.w900, letterSpacing: -.8))),
          Material(
            color: const Color(0xFFF1F1F1),
            shape: const CircleBorder(),
            child: InkWell(customBorder: const CircleBorder(), onTap: onTap, child: const SizedBox(width: 44, height: 44, child: Icon(Icons.arrow_forward_rounded))),
          ),
        ],
      ),
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
      width: 300,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _MerchantImage(merchant: merchant, height: 176),
            const SizedBox(height: 9),
            Row(
              children: [
                Expanded(child: Text(merchant['name'].toString(), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900))),
                const Icon(Icons.favorite_border_rounded, size: 23),
              ],
            ),
            const SizedBox(height: 3),
            Text(_deliverySummary(branch, merchant), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.black54, fontSize: 14)),
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
    final location = [branch?['name'], branch?['city']].where((value) => value != null && '$value'.trim().isNotEmpty).join(' · ');
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _MerchantImage(merchant: merchant, height: 205),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(merchant['name'].toString(), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 2),
                    Text(_deliverySummary(branch, merchant), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.black54)),
                    if (location.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(location, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.black45, fontSize: 13)),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 10),
              const Icon(Icons.favorite_border_rounded),
            ],
          ),
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
    final image = merchant['coverImageUrl']?.toString().trim();
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: image != null && image.isNotEmpty
          ? Image.network(image, width: double.infinity, height: height, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _FallbackMerchantImage(merchant: merchant, height: height))
          : _FallbackMerchantImage(merchant: merchant, height: height),
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
    return Container(
      width: double.infinity,
      height: height,
      decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0xFFF6DEC1), Color(0xFFDCEBDD)], begin: Alignment.topLeft, end: Alignment.bottomRight)),
      alignment: Alignment.center,
      child: Icon(icon, size: 62, color: Colors.black54),
    );
  }
}

Map<String, dynamic>? _firstBranch(Map<String, dynamic> merchant) {
  final branches = merchant['branches'] as List? ?? const [];
  if (branches.isEmpty || branches.first is! Map) return null;
  return (branches.first as Map).cast<String, dynamic>();
}

String _deliverySummary(Map<String, dynamic>? branch, Map<String, dynamic> merchant) {
  if (branch == null) return merchant['merchantType']?.toString().replaceAll('_', ' ').toLowerCase() ?? 'Merchant';
  final pickup = branch['pickupEnabled'] == true;
  final delivery = branch['deliveryEnabled'] == true;
  final zones = branch['deliveryZones'] as List? ?? const [];
  final free = zones.any((zone) => zone is Map && asDouble(zone['fee']) == 0);
  if (delivery && free) return 'Free delivery nearby · Delivery available';
  if (delivery) return 'Delivery available · Fee at checkout';
  if (pickup) return 'Pickup available';
  return 'Open for orders';
}
