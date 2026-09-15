import 'package:flutter/material.dart';

import 'api_client.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const FidaMerchantApp());
}

class FidaMerchantApp extends StatefulWidget {
  const FidaMerchantApp({super.key});

  @override
  State<FidaMerchantApp> createState() => _FidaMerchantAppState();
}

class _FidaMerchantAppState extends State<FidaMerchantApp> {
  final api = MerchantApiClient();
  Map<String, dynamic>? user;
  List<Map<String, dynamic>> memberships = [];
  Map<String, dynamic>? membership;
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    await api.restore();
    final restored = await api.me();
    if (restored != null) {
      user = restored;
      await _loadTenants();
    }
    if (mounted) setState(() => loading = false);
  }

  Future<void> _loadTenants() async {
    try {
      memberships = await api.tenants();
      membership = memberships.isEmpty ? null : memberships.first;
      error = null;
    } on MerchantApiException catch (e) {
      error = e.message;
    }
  }

  Future<bool> _login(String email, String password) async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      user = await api.login(email.trim(), password);
      await _loadTenants();
      return true;
    } on MerchantApiException catch (e) {
      error = e.message;
      return false;
    } catch (_) {
      error = 'Unable to connect to Fida Marketplace.';
      return false;
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<bool> _createMerchant({
    required String name,
    required String merchantType,
    required String branchName,
    required String city,
    required String addressLine,
  }) async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      await api.createTenant(
        name: name,
        merchantType: merchantType,
        branchName: branchName,
        city: city,
        addressLine: addressLine,
      );
      await _loadTenants();
      return true;
    } on MerchantApiException catch (e) {
      error = e.message;
      return false;
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _logout() async {
    await api.logout();
    if (!mounted) return;
    setState(() {
      user = null;
      memberships = [];
      membership = null;
      error = null;
    });
  }

  @override
  void dispose() {
    api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Fida Marketplace Merchant',
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF176B55),
        scaffoldBackgroundColor: const Color(0xFFF8FAF9),
      ),
      home: loading && user == null
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : user == null
              ? _LoginScreen(onLogin: _login, error: error, loading: loading)
              : membership == null
                  ? _MerchantOnboardingScreen(
                      onCreate: _createMerchant,
                      onLogout: _logout,
                      error: error,
                      loading: loading,
                    )
                  : _MerchantShell(
                      api: api,
                      memberships: memberships,
                      selected: membership!,
                      onSelect: (value) => setState(() => membership = value),
                      onLogout: _logout,
                    ),
    );
  }
}

class _LoginScreen extends StatefulWidget {
  const _LoginScreen({required this.onLogin, required this.error, required this.loading});

  final Future<bool> Function(String, String) onLogin;
  final String? error;
  final bool loading;

  @override
  State<_LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<_LoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  bool obscure = true;

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.store_rounded, size: 74),
                  const SizedBox(height: 16),
                  Text(
                    'Fida Marketplace',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900),
                  ),
                  const Text('Merchant', textAlign: TextAlign.center),
                  const SizedBox(height: 32),
                  TextField(
                    controller: email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: password,
                    obscureText: obscure,
                    onSubmitted: (_) => widget.onLogin(email.text, password.text),
                    decoration: InputDecoration(
                      labelText: 'Password',
                      border: const OutlineInputBorder(),
                      suffixIcon: IconButton(
                        onPressed: () => setState(() => obscure = !obscure),
                        icon: Icon(obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                      ),
                    ),
                  ),
                  if (widget.error != null) ...[
                    const SizedBox(height: 12),
                    Text(widget.error!, textAlign: TextAlign.center, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ],
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: widget.loading ? null : () => widget.onLogin(email.text, password.text),
                    icon: widget.loading
                        ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.login_rounded),
                    label: const Padding(padding: EdgeInsets.symmetric(vertical: 14), child: Text('Sign in')),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MerchantOnboardingScreen extends StatefulWidget {
  const _MerchantOnboardingScreen({
    required this.onCreate,
    required this.onLogout,
    required this.error,
    required this.loading,
  });

  final Future<bool> Function({
    required String name,
    required String merchantType,
    required String branchName,
    required String city,
    required String addressLine,
  }) onCreate;
  final Future<void> Function() onLogout;
  final String? error;
  final bool loading;

  @override
  State<_MerchantOnboardingScreen> createState() => _MerchantOnboardingScreenState();
}

class _MerchantOnboardingScreenState extends State<_MerchantOnboardingScreen> {
  final name = TextEditingController();
  final branch = TextEditingController(text: 'Main Branch');
  final city = TextEditingController(text: 'Kigali');
  final address = TextEditingController();
  String merchantType = 'RESTAURANT';

  @override
  void dispose() {
    name.dispose();
    branch.dispose();
    city.dispose();
    address.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (name.text.trim().length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter the business name.')));
      return;
    }
    await widget.onCreate(
      name: name.text.trim(),
      merchantType: merchantType,
      branchName: branch.text.trim().isEmpty ? 'Main Branch' : branch.text.trim(),
      city: city.text.trim(),
      addressLine: address.text.trim(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create merchant'),
        actions: [IconButton(onPressed: widget.onLogout, icon: const Icon(Icons.logout_rounded))],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const Icon(Icons.storefront_rounded, size: 60),
            const SizedBox(height: 12),
            Text('Start selling on Fida Marketplace', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            const Text('Create your merchant profile. A platform administrator will activate it before customers can order.'),
            const SizedBox(height: 24),
            TextField(controller: name, decoration: const InputDecoration(labelText: 'Business name', border: OutlineInputBorder())),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              initialValue: merchantType,
              decoration: const InputDecoration(labelText: 'Business type', border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(value: 'RESTAURANT', child: Text('Restaurant')),
                DropdownMenuItem(value: 'SUPERMARKET', child: Text('Supermarket')),
                DropdownMenuItem(value: 'PHARMACY', child: Text('Pharmacy')),
                DropdownMenuItem(value: 'RETAIL', child: Text('Retail')),
                DropdownMenuItem(value: 'OTHER', child: Text('Other')),
              ],
              onChanged: (value) => setState(() => merchantType = value ?? 'OTHER'),
            ),
            const SizedBox(height: 14),
            TextField(controller: branch, decoration: const InputDecoration(labelText: 'Branch name', border: OutlineInputBorder())),
            const SizedBox(height: 14),
            TextField(controller: city, decoration: const InputDecoration(labelText: 'City', border: OutlineInputBorder())),
            const SizedBox(height: 14),
            TextField(controller: address, decoration: const InputDecoration(labelText: 'Address', border: OutlineInputBorder())),
            if (widget.error != null) ...[
              const SizedBox(height: 12),
              Text(widget.error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: widget.loading ? null : submit,
              icon: widget.loading
                  ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.add_business_rounded),
              label: const Padding(padding: EdgeInsets.symmetric(vertical: 14), child: Text('Create merchant')),
            ),
          ],
        ),
      ),
    );
  }
}

class _MerchantShell extends StatefulWidget {
  const _MerchantShell({
    required this.api,
    required this.memberships,
    required this.selected,
    required this.onSelect,
    required this.onLogout,
  });

  final MerchantApiClient api;
  final List<Map<String, dynamic>> memberships;
  final Map<String, dynamic> selected;
  final ValueChanged<Map<String, dynamic>> onSelect;
  final Future<void> Function() onLogout;

  @override
  State<_MerchantShell> createState() => _MerchantShellState();
}

class _MerchantShellState extends State<_MerchantShell> {
  int index = 0;

  String get tenantId => ((widget.selected['tenant'] as Map)['id']).toString();
  Map get tenant => widget.selected['tenant'] as Map;

  @override
  Widget build(BuildContext context) {
    final pages = [
      _OrdersPage(api: widget.api, tenantId: tenantId),
      _CatalogPage(api: widget.api, tenantId: tenantId),
      _MerchantAccount(
        membership: widget.selected,
        memberships: widget.memberships,
        onSelect: widget.onSelect,
        onLogout: widget.onLogout,
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(tenant['name'].toString(), style: const TextStyle(fontWeight: FontWeight.w800)),
            Text('${tenant['status']} · ${widget.selected['role']}', style: Theme.of(context).textTheme.labelSmall),
          ],
        ),
      ),
      body: IndexedStack(index: index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long_rounded), label: 'Orders'),
          NavigationDestination(icon: Icon(Icons.inventory_2_outlined), selectedIcon: Icon(Icons.inventory_2_rounded), label: 'Catalog'),
          NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings_rounded), label: 'Account'),
        ],
      ),
    );
  }
}

class _OrdersPage extends StatefulWidget {
  const _OrdersPage({required this.api, required this.tenantId});
  final MerchantApiClient api;
  final String tenantId;

  @override
  State<_OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends State<_OrdersPage> {
  List<Map<String, dynamic>> orders = [];
  bool loading = true;
  String? error;
  String? filter;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final rows = await widget.api.orders(widget.tenantId, status: filter);
      if (mounted) setState(() => orders = rows);
    } on MerchantApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  List<String> actions(String status) => switch (status) {
        'PENDING' => ['ACCEPTED', 'REJECTED'],
        'ACCEPTED' => ['PREPARING'],
        'PREPARING' => ['READY_FOR_PICKUP'],
        _ => const [],
      };

  Future<void> move(Map<String, dynamic> order, String status) async {
    try {
      await widget.api.updateOrderStatus(widget.tenantId, order['id'].toString(), status);
      await load();
    } on MerchantApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: load,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: SizedBox(
              height: 56,
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                scrollDirection: Axis.horizontal,
                children: [
                  for (final value in <String?>[null, 'PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP']) ...[
                    ChoiceChip(
                      label: Text(value?.replaceAll('_', ' ').toLowerCase() ?? 'all'),
                      selected: filter == value,
                      onSelected: (_) {
                        setState(() => filter = value);
                        load();
                      },
                    ),
                    const SizedBox(width: 8),
                  ],
                ],
              ),
            ),
          ),
          if (loading)
            const SliverFillRemaining(hasScrollBody: false, child: Center(child: CircularProgressIndicator()))
          else if (error != null)
            SliverFillRemaining(hasScrollBody: false, child: Center(child: Text(error!)))
          else if (orders.isEmpty)
            const SliverFillRemaining(hasScrollBody: false, child: Center(child: Text('No orders in this queue.')))
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
              sliver: SliverList.separated(
                itemCount: orders.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final order = orders[index];
                  final customer = order['customer'] as Map? ?? {};
                  final items = order['items'] as List? ?? const [];
                  final next = actions(order['status'].toString());
                  return Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(child: Text(order['orderNumber'].toString(), style: const TextStyle(fontWeight: FontWeight.w900))),
                              Chip(label: Text(order['status'].toString().replaceAll('_', ' ').toLowerCase())),
                            ],
                          ),
                          Text([customer['firstName'], customer['lastName']].where((v) => v != null && '$v'.isNotEmpty).join(' ')),
                          const SizedBox(height: 8),
                          ...items.take(4).map((raw) {
                            final item = raw as Map;
                            return Text('${item['quantity']} × ${item['productName']}');
                          }),
                          if (items.length > 4) Text('+ ${items.length - 4} more'),
                          const SizedBox(height: 10),
                          Text('Total: ${order['total']} · ${order['paymentMethod']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                          Text('Deliver to: ${order['deliveryAddress']}'),
                          if (next.isNotEmpty) ...[
                            const SizedBox(height: 14),
                            Wrap(
                              spacing: 8,
                              children: next.map((status) {
                                if (status == 'REJECTED') {
                                  return OutlinedButton(onPressed: () => move(order, status), child: const Text('Reject'));
                                }
                                return FilledButton(onPressed: () => move(order, status), child: Text(status.replaceAll('_', ' ').toLowerCase()));
                              }).toList(),
                            ),
                          ],
                        ],
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

class _CatalogPage extends StatefulWidget {
  const _CatalogPage({required this.api, required this.tenantId});
  final MerchantApiClient api;
  final String tenantId;

  @override
  State<_CatalogPage> createState() => _CatalogPageState();
}

class _CatalogPageState extends State<_CatalogPage> {
  List<Map<String, dynamic>> products = [];
  List<Map<String, dynamic>> categories = [];
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final values = await Future.wait([
        widget.api.products(widget.tenantId),
        widget.api.categories(widget.tenantId),
      ]);
      if (!mounted) return;
      setState(() {
        products = values[0];
        categories = values[1];
      });
    } on MerchantApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> addCategory() async {
    String categoryName = '';
    final result = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('New category'),
        content: TextField(
          autofocus: true,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(labelText: 'Category name', border: OutlineInputBorder()),
          onChanged: (value) => categoryName = value.trim(),
          onSubmitted: (value) => Navigator.pop(dialogContext, value.trim()),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, categoryName), child: const Text('Create')),
        ],
      ),
    );
    if (result == null || result.trim().isEmpty) return;
    try {
      await widget.api.createCategory(widget.tenantId, result.trim());
      await load();
    } on MerchantApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> addProduct() async {
    String productName = '';
    String priceText = '';
    String? categoryId = categories.isEmpty ? null : categories.first['id'].toString();

    final create = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('New product'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(labelText: 'Product name', border: OutlineInputBorder()),
                  onChanged: (value) => productName = value.trim(),
                ),
                const SizedBox(height: 12),
                TextField(
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Price (RWF)', border: OutlineInputBorder()),
                  onChanged: (value) => priceText = value.trim(),
                ),
                if (categories.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: categoryId,
                    decoration: const InputDecoration(labelText: 'Category', border: OutlineInputBorder()),
                    items: categories
                        .map((category) => DropdownMenuItem<String>(
                              value: category['id'].toString(),
                              child: Text(category['name'].toString()),
                            ))
                        .toList(),
                    onChanged: (value) => setDialogState(() => categoryId = value),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Create')),
          ],
        ),
      ),
    );

    if (create != true) return;
    final price = double.tryParse(priceText);
    if (productName.isEmpty || price == null || price < 0) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a product name and a valid price.')));
      }
      return;
    }

    try {
      await widget.api.createProduct(
        widget.tenantId,
        name: productName,
        price: price,
        categoryId: categoryId,
      );
      await load();
    } on MerchantApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());

    return RefreshIndicator(
      onRefresh: load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 100),
        children: [
          Text('${products.length} products · ${categories.length} categories'),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              OutlinedButton.icon(
                onPressed: addCategory,
                icon: const Icon(Icons.create_new_folder_outlined),
                label: const Text('Add category'),
              ),
              FilledButton.icon(
                onPressed: addProduct,
                icon: const Icon(Icons.add_box_outlined),
                label: const Text('Add product'),
              ),
            ],
          ),
          if (error != null) ...[
            const SizedBox(height: 16),
            Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          if (products.isEmpty) ...[
            const SizedBox(height: 100),
            const Icon(Icons.inventory_2_outlined, size: 54),
            const SizedBox(height: 12),
            const Text('No products yet.', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            const Text('Create a category, then add your first product.', textAlign: TextAlign.center),
          ] else ...[
            const SizedBox(height: 18),
            for (final product in products)
              Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.inventory_2_outlined)),
                  title: Text(product['name'].toString()),
                  subtitle: Text((product['category'] as Map?)?['name']?.toString() ?? 'Uncategorised'),
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('${product['price']} RWF', style: const TextStyle(fontWeight: FontWeight.w800)),
                      Text(product['isAvailable'] == true ? 'available' : 'unavailable'),
                    ],
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _MerchantAccount extends StatelessWidget {
  const _MerchantAccount({
    required this.membership,
    required this.memberships,
    required this.onSelect,
    required this.onLogout,
  });

  final Map<String, dynamic> membership;
  final List<Map<String, dynamic>> memberships;
  final ValueChanged<Map<String, dynamic>> onSelect;
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    final tenant = membership['tenant'] as Map;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const CircleAvatar(radius: 38, child: Icon(Icons.store_rounded, size: 38)),
        const SizedBox(height: 12),
        Text(
          tenant['name'].toString(),
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
        ),
        Text('${tenant['status']} · ${membership['role']}', textAlign: TextAlign.center),
        const SizedBox(height: 22),
        if (memberships.length > 1)
          DropdownButtonFormField<String>(
            initialValue: tenant['id'].toString(),
            decoration: const InputDecoration(labelText: 'Merchant', border: OutlineInputBorder()),
            items: memberships.map((item) {
              final option = item['tenant'] as Map;
              return DropdownMenuItem(value: option['id'].toString(), child: Text(option['name'].toString()));
            }).toList(),
            onChanged: (id) {
              if (id == null) return;
              onSelect(memberships.firstWhere((item) => (item['tenant'] as Map)['id'].toString() == id));
            },
          ),
        const SizedBox(height: 18),
        Card(
          child: ListTile(
            leading: Icon(tenant['status'] == 'ACTIVE' ? Icons.verified_rounded : Icons.hourglass_top_rounded),
            title: Text(tenant['status'] == 'ACTIVE' ? 'Marketplace active' : 'Awaiting platform approval'),
            subtitle: const Text('Only active merchants are visible to customers.'),
          ),
        ),
        const SizedBox(height: 18),
        OutlinedButton.icon(
          onPressed: onLogout,
          icon: const Icon(Icons.logout_rounded),
          label: const Padding(padding: EdgeInsets.symmetric(vertical: 13), child: Text('Sign out')),
        ),
      ],
    );
  }
}
