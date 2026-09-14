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
  List<Map<String, dynamic>> _merchants = [];
  bool _loading = true;
  String? _error;
  String? _type;

  static const _types = <String, String>{
    'RESTAURANT': 'Restaurants',
    'SUPERMARKET': 'Supermarkets',
    'PHARMACY': 'Pharmacies',
    'RETAIL': 'Shops',
  };

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

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'What do you need today?',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  const Text('Browse approved merchants currently accepting orders.'),
                  const SizedBox(height: 18),
                  SizedBox(
                    height: 42,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        ChoiceChip(
                          label: const Text('All'),
                          selected: _type == null,
                          onSelected: (_) {
                            setState(() => _type = null);
                            _load();
                          },
                        ),
                        const SizedBox(width: 8),
                        for (final entry in _types.entries) ...[
                          ChoiceChip(
                            label: Text(entry.value),
                            selected: _type == entry.key,
                            onSelected: (_) {
                              setState(() => _type = entry.key);
                              _load();
                            },
                          ),
                          const SizedBox(width: 8),
                        ],
                      ],
                    ),
                  ),
                ],
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
                      FilledButton(onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                ),
              ),
            )
          else if (_merchants.isEmpty)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: Center(child: Text('No merchants are available in this category yet.')),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
              sliver: SliverList.separated(
                itemCount: _merchants.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final merchant = _merchants[index];
                  final branches = (merchant['branches'] as List? ?? const []);
                  final branch = branches.isNotEmpty ? (branches.first as Map) : null;
                  final currency = (merchant['currency'] ?? 'RWF').toString();
                  return Card(
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => MerchantScreen(api: widget.api, slug: merchant['slug'].toString()),
                        ),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.primaryContainer,
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Icon(
                                merchant['merchantType'] == 'RESTAURANT'
                                    ? Icons.restaurant_rounded
                                    : merchant['merchantType'] == 'PHARMACY'
                                        ? Icons.local_pharmacy_rounded
                                        : Icons.storefront_rounded,
                                size: 34,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    merchant['name'].toString(),
                                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    branch == null
                                        ? merchant['merchantType'].toString()
                                        : [branch['name'], branch['city']].where((v) => v != null && '$v'.isNotEmpty).join(' · '),
                                  ),
                                  const SizedBox(height: 8),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 4,
                                    children: [
                                      _MetaChip(
                                        icon: Icons.delivery_dining_rounded,
                                        text: money(merchant['defaultDeliveryFee'], currency: currency),
                                      ),
                                      if (asDouble(merchant['minimumOrder']) > 0)
                                        _MetaChip(
                                          icon: Icons.shopping_bag_outlined,
                                          text: 'Min ${money(merchant['minimumOrder'], currency: currency)}',
                                        ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right_rounded),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15),
          const SizedBox(width: 4),
          Text(text, style: Theme.of(context).textTheme.labelMedium),
        ],
      ),
    );
  }
}
