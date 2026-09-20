import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:fida_mobile_common/fida_mobile_common.dart';
import '../core/api_client.dart';
import '../ui/format.dart';
import 'product_screen.dart';
import 'cart_screen.dart';

class MerchantScreen extends StatefulWidget {
  const MerchantScreen({
    super.key,
    required this.api,
    required this.slug,
    this.initialFulfillment = 'DELIVERY',
  });
  final ApiClient api;
  final String slug, initialFulfillment;
  @override
  State<MerchantScreen> createState() => _MerchantScreenState();
}

class _MerchantScreenState extends State<MerchantScreen> {
  Map<String, dynamic>? merchant;
  final Map<String, int> cart = {};
  final Map<String, Map<String, dynamic>> products = {};
  String? error, category;
  String query = '', mode = 'DELIVERY';
  bool loading = true, favorite = false, savingFavorite = false;
  int branchIndex = 0;
  @override
  void initState() {
    super.initState();
    mode = widget.initialFulfillment;
    load();
  }

  Future<void> load() async {
    try {
      final m = await widget.api.merchant(widget.slug);
      if (!mounted) return;
      setState(() {
        merchant = m;
        loading = false;
        error = null;
        final bs = m['branches'] as List? ?? [];
        if (branchIndex >= bs.length) branchIndex = 0;
        if (bs.isNotEmpty &&
            bs[branchIndex][mode == 'DELIVERY'
                    ? 'deliveryEnabled'
                    : 'pickupEnabled'] !=
                true)
          mode = bs[branchIndex]['pickupEnabled'] == true
              ? 'PICKUP'
              : 'DELIVERY';
      });
      try {
        final saved =
            await widget.api.request('GET', '/v1/customer/favorites') as List;
        if (mounted)
          setState(() => favorite = saved.any((f) => f['id'] == m['id']));
      } catch (_) {}
    } catch (e) {
      if (mounted)
        setState(() {
          error = '$e';
          loading = false;
        });
    }
  }

  Future<void> add(Map<String, dynamic> p) async {
    final result = await Navigator.push<Map>(
      context,
      MaterialPageRoute(
        builder: (_) => ProductScreen(
          product: p,
          currency: merchant?['currency']?.toString() ?? 'RWF',
        ),
      ),
    );
    if (result == null || !mounted) return;
    final configured = (result['product'] as Map).cast<String, dynamic>();
    final key = jsonEncode([
      configured['productId'],
      configured['selectedOptions'],
    ]);
    final count = result['quantity'] as int;
    final totalForProduct = cart.entries
        .where((e) => products[e.key]?['productId'] == configured['productId'])
        .fold<int>(0, (sum, e) => sum + e.value);
    if (totalForProduct + count > 50) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Maximum 50 of the same product per order.'),
        ),
      );
      return;
    }
    setState(() {
      products[key] = configured;
      cart[key] = (cart[key] ?? 0) + count;
    });
  }

  Future<void> viewCart() async {
    final branches = merchant!['branches'] as List? ?? [];
    if (branches.isEmpty) return;
    final placed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => CartScreen(
          api: widget.api,
          merchant: {
            ...merchant!,
            'branches': [branches[branchIndex]],
          },
          cart: cart,
          products: products,
          fulfillment: mode,
        ),
      ),
    );
    if (mounted)
      setState(() {
        if (placed == true) {
          cart.clear();
          products.clear();
        }
      });
  }

  @override
  Widget build(BuildContext context) {
    if (loading)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (merchant == null)
      return Scaffold(
        appBar: AppBar(),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(error ?? 'Unable to open store'),
              TextButton(onPressed: load, child: const Text('Retry')),
            ],
          ),
        ),
      );
    final m = merchant!, currency = m['currency']?.toString() ?? 'RWF';
    final categories = m['categories'] as List? ?? [],
        branches = m['branches'] as List? ?? [];
    final branch = branches.isEmpty
        ? <String, dynamic>{}
        : branches[branchIndex] as Map;
    final count = cart.values.fold<int>(0, (a, b) => a + b),
        subtotal = cart.entries.fold<double>(
          0,
          (sum, e) => sum + asDouble(products[e.key]?['price']) * e.value,
        );
    final promos = m['promotions'] as List? ?? [];
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
        onRefresh: load,
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              expandedHeight: 235,
              pinned: true,
              // This white cap belongs to the menu panel. Painting it in the
              // app-bar bottom keeps the pinned hero from covering its corners.
              bottom: PreferredSize(
                preferredSize: const Size.fromHeight(24),
                child: Container(
                  key: const ValueKey('menu-panel-top'),
                  height: 24,
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                  ),
                ),
              ),
              leading: Padding(
                padding: const EdgeInsets.all(5),
                child: IconButton.filledTonal(
                  onPressed: () async {
                    if (cart.isNotEmpty) {
                      final leave = await showDialog<bool>(
                        context: context,
                        builder: (c) => AlertDialog(
                          title: const Text('Leave this cart?'),
                          content: const Text(
                            'Your current cart will be cleared.',
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(c, false),
                              child: const Text('Keep shopping'),
                            ),
                            TextButton(
                              onPressed: () => Navigator.pop(c, true),
                              child: const Text('Leave'),
                            ),
                          ],
                        ),
                      );
                      if (leave != true) return;
                    }
                    if (context.mounted) Navigator.pop(context);
                  },
                  icon: const Icon(Icons.arrow_back),
                ),
              ),
              actions: [
                IconButton.filledTonal(
                  tooltip: 'Save store',
                  onPressed: savingFavorite
                      ? null
                      : () async {
                          setState(() => savingFavorite = true);
                          try {
                            await widget.api.request(
                              favorite ? 'DELETE' : 'PUT',
                              '/v1/customer/favorites/${m['id']}',
                            );
                            if (mounted) setState(() => favorite = !favorite);
                          } catch (e) {
                            if (mounted)
                              ScaffoldMessenger.of(
                                context,
                              ).showSnackBar(SnackBar(content: Text('$e')));
                          } finally {
                            if (mounted) setState(() => savingFavorite = false);
                          }
                        },
                  icon: Icon(favorite ? Icons.favorite : Icons.favorite_border),
                ),
                const SizedBox(width: 12),
              ],
              flexibleSpace: FlexibleSpaceBar(
                background: FoodCover(
                  url: m['imageUrl']?.toString(),
                  baseUrl: ApiClient.baseUrl,
                  height: 270,
                  radius: 0,
                  label: m['name'].toString(),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Container(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                decoration: const BoxDecoration(
                  color: Colors.white,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      m['name'].toString(),
                      style: const TextStyle(
                        fontSize: 30,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -.7,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      m['rating'] == null
                          ? 'New on Fida'
                          : '${asDouble(m['rating']).toStringAsFixed(1)} ★ (${m['reviewCount']} reviews)',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      [
                        branch['addressLine'],
                        branch['city'],
                      ].whereType<String>().join(', '),
                      style: const TextStyle(color: Colors.black54),
                    ),
                    if (branches.length > 1)
                      DropdownButton<int>(
                        isExpanded: true,
                        value: branchIndex,
                        items: [
                          for (var i = 0; i < branches.length; i++)
                            DropdownMenuItem(
                              value: i,
                              child: Text(branches[i]['name'].toString()),
                            ),
                        ],
                        onChanged: (v) {
                          if (v != null)
                            setState(() {
                              branchIndex = v;
                              if (branches[v][mode == 'DELIVERY'
                                      ? 'deliveryEnabled'
                                      : 'pickupEnabled'] !=
                                  true)
                                mode = branches[v]['pickupEnabled'] == true
                                    ? 'PICKUP'
                                    : 'DELIVERY';
                            });
                        },
                      ),
                    const SizedBox(height: 18),
                    SegmentedButton<String>(
                      segments: [
                        if (branch['deliveryEnabled'] == true)
                          const ButtonSegment(
                            value: 'DELIVERY',
                            label: Text('Delivery'),
                            icon: Icon(Icons.delivery_dining),
                          ),
                        if (branch['pickupEnabled'] == true)
                          const ButtonSegment(
                            value: 'PICKUP',
                            label: Text('Pickup'),
                            icon: Icon(Icons.shopping_bag_outlined),
                          ),
                        if (branch['pickupEnabled'] != true &&
                            branch['deliveryEnabled'] != true)
                          const ButtonSegment(
                            value: 'DELIVERY',
                            label: Text('Unavailable'),
                            enabled: false,
                          ),
                      ],
                      selected: {mode},
                      onSelectionChanged: (s) => setState(() => mode = s.first),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(15),
                      decoration: BoxDecoration(
                        border: Border.all(color: const Color(0xFFEAEAEA)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              children: [
                                Text(
                                  mode == 'PICKUP'
                                      ? 'Free pickup'
                                      : 'Delivery by distance',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 5),
                                const Text(
                                  'Fee confirmed at checkout',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.black54,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Expanded(
                            child: Column(
                              children: [
                                Text(
                                  branch['isOpen'] == false
                                      ? 'Closed now'
                                      : 'Accepting orders',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 5),
                                Text(
                                  asDouble(m['minimumOrder']) > 0
                                      ? 'Min ${money(m['minimumOrder'], currency: currency)}'
                                      : 'No minimum order',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: Colors.black54,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    for (final promo in promos)
                      Container(
                        margin: const EdgeInsets.only(top: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFE5D8),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.local_offer,
                              color: Color(0xFFB24725),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                '${promotionDescription(promo, currency)}\nMin ${money(promo['minimumOrder'], currency: currency)} · Max ${money(promo['maxDiscount'], currency: currency)}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    const SectionHeading('Explore the menu'),
                    TextField(
                      onChanged: (v) => setState(() => query = v.toLowerCase()),
                      decoration: const InputDecoration(
                        hintText: 'Search this menu',
                        prefixIcon: Icon(Icons.search),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          ChoiceChip(
                            label: const Text('All'),
                            selected: category == null,
                            onSelected: (_) => setState(() => category = null),
                          ),
                          for (final c in categories)
                            Padding(
                              padding: const EdgeInsets.only(left: 8),
                              child: ChoiceChip(
                                label: Text(c['name'].toString()),
                                selected: category == c['id'],
                                onSelected: (_) => setState(
                                  () => category = c['id'].toString(),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (query.isEmpty && category == null && categories.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(left: 20, bottom: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SectionHeading('From the menu'),
                      SizedBox(
                        height: 230,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          children: [
                            for (final raw
                                in categories
                                    .expand((c) => c['products'] as List? ?? [])
                                    .take(8))
                              Padding(
                                padding: const EdgeInsets.only(right: 14),
                                child: SizedBox(
                                  width: 170,
                                  child: InkWell(
                                    onTap: () => add(
                                      (raw as Map).cast<String, dynamic>(),
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Stack(
                                          children: [
                                            FoodCover(
                                              url: raw['imageUrl']?.toString(),
                                              baseUrl: ApiClient.baseUrl,
                                              height: 156,
                                              label: raw['name'].toString(),
                                            ),
                                            Positioned(
                                              right: 4,
                                              bottom: 4,
                                              child: IconButton.filledTonal(
                                                onPressed: () => add(
                                                  (raw as Map)
                                                      .cast<String, dynamic>(),
                                                ),
                                                icon: const Icon(Icons.add),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        Text(
                                          raw['name'].toString(),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 17,
                                          ),
                                        ),
                                        Text(
                                          money(
                                            raw['price'],
                                            currency: currency,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            for (final c in categories.where(
              (c) => category == null || category == c['id'],
            )) ...[
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: SectionHeading(c['name'].toString()),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                sliver: SliverList.list(
                  children: [
                    for (final raw in (c['products'] as List? ?? []).where(
                      (p) => '${p['name']} ${p['description'] ?? ''}'
                          .toLowerCase()
                          .contains(query),
                    ))
                      Builder(
                        builder: (_) {
                          final p = (raw as Map).cast<String, dynamic>();
                          return InkWell(
                            onTap: () => add(p),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              decoration: const BoxDecoration(
                                border: Border(
                                  bottom: BorderSide(color: Color(0xFFEEEEEE)),
                                ),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          p['name'].toString(),
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 18,
                                          ),
                                        ),
                                        const SizedBox(height: 5),
                                        Text(
                                          money(p['price'], currency: currency),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          p['description']?.toString() ?? '',
                                          maxLines: 3,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            color: Colors.black54,
                                          ),
                                        ),
                                        if ((p['options'] as List? ?? [])
                                            .isNotEmpty)
                                          const Padding(
                                            padding: EdgeInsets.only(top: 5),
                                            child: Text(
                                              'Customise',
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: Color(0xFF07855A),
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  SizedBox(
                                    width: 112,
                                    height: 118,
                                    child: Stack(
                                      children: [
                                        ProductPhoto(
                                          url: p['imageUrl']?.toString(),
                                          baseUrl: ApiClient.baseUrl,
                                          size: 112,
                                        ),
                                        Positioned(
                                          right: 3,
                                          bottom: 0,
                                          child: IconButton.filledTonal(
                                            tooltip: 'Add ${p['name']}',
                                            onPressed: () => add(p),
                                            icon: const Icon(Icons.add),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                  ],
                ),
              ),
            ],
            if (categories.isEmpty)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.all(32),
                  child: Text('The merchant is updating their menu.'),
                ),
              ),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
      ),
      bottomNavigationBar: cart.isEmpty
          ? null
          : SafeArea(
              minimum: const EdgeInsets.all(16),
              child: FilledButton(
                onPressed: viewCart,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.white24,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text('$count'),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Text(
                          'View cart',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Text(
                        money(subtotal, currency: currency),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
              ),
            ),
    );
  }
}
