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
      membership ??= memberships.isEmpty ? null : memberships.first;
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

  Future<void> _logout() async {
    await api.logout();
    if (!mounted) return;
    setState(() {
      user = null;
      memberships = [];
      membership = null;
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
                  ? _NoMerchantScreen(onLogout: _logout)
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

class _NoMerchantScreen extends StatelessWidget {
  const _NoMerchantScreen({required this.onLogout});
  final Future<void> Function() onLogout;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(actions: [IconButton(onPressed: onLogout, icon: const Icon(Icons.logout_rounded))]),
      body: const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.store_mall_directory_outlined, size: 60),
              SizedBox(height: 14),
              Text('No merchant account', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
              SizedBox(height: 8),
              Text('This user is not yet a member of a Fida Marketplace merchant.', textAlign: TextAlign.center),
            ],
          ),
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
                              Expanded(
                                child: Text(order['orderNumber'].toString(), style: const TextStyle(fontWeight: FontWeight.w900)),
                              ),
                              Chip(label: Text(order['status'].toString().replaceAll('_', ' ').toLowerCase())),
                            ],
                          ),
                          Text([
                            customer['firstName'],
                            customer['lastName'],
                          ].where((v) => v != null && '$v'.isNotEmpty).join(' ')),
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
                                final destructive = status == 'REJECTED';
                                return destructive
                                    ? OutlinedButton(onPressed: () => move(order, status), child: const Text('Reject'))
                                    : FilledButton(onPressed: () => move(order, status), child: Text(status.replaceAll('_', ' ').toLowerCase()));
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

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() => loading = true);
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
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> addCategory() async {
    final controller = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('New category'),
        content: TextField(controller: controller, autofocus: true, decoration: const InputDecoration(labelText: 'Name')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, controller.text.trim()), child: const Text('Create')),
        ],
      ),
    );
    controller.dispose();
    if (name == null || name.isEmpty) return;
    await widget.api.createCategory(widget.tenantId, name);
    await load();
  }

  Future<void> addProduct() async {
    final name = TextEditingController();
    final price = TextEditingController();
    String? categoryId = categories.isEmpty ? null : categories.first['id'].toString();
    final create = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('New product'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: name, decoration: const InputDecoration(labelText: 'Product name')),
              const SizedBox(height: 10),
              TextField(controller: price, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Price')),
              if (categories.isNotEmpty) ...[
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: categoryId,
                  decoration: const InputDecoration(labelText: 'Category'),
                  items: categories
                      .map((category) => DropdownMenuItem(value: category['id'].toString(), child: Text(category['name'].toString())))
                      .toList(),
                  onChanged: (value) => setDialogState(() => categoryId = value),
                ),
              ],
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Create')),
          ],
        ),
      ),
    );
    final value = double.tryParse(price.text.trim());
    if (create == true && name.text.trim().isNotEmpty && value != null) {
      await widget.api.createProduct(widget.tenantId, name: name.text.trim(), price: value, categoryId: categoryId);
      await load();
    }
    name.dispose();
    price.dispose();
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
          Row(
            children: [
              Expanded(child: Text('${products.length} products · ${categories.length} categories')),
              PopupMenuButton<String>(
                icon: const Icon(Icons.add_circle_outline_rounded),
                onSelected: (value) => value == 'category' ? addCategory() : addProduct(),
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'product', child: Text('Add product')),
                  PopupMenuItem(value: 'category', child: Text('Add category')),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
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
                    Text(product['price'].toString(), style: const TextStyle(fontWeight: FontWeight.w800)),
                    Text(product['isAvailable'] == true ? 'available' : 'unavailable'),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _MerchantAccount extends StatelessWidget {
  const _MerchantAccount({required this.membership, required this.memberships, required this.onSelect, required this.onLogout});

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
        Text(tenant['name'].toString(), textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
        Text('${tenant['status']} · ${membership['role']}', textAlign: TextAlign.center),
        const SizedBox(height: 22),
        if (memberships.length > 1)
          DropdownButtonFormField<String>(
            initialValue: tenant['id'].toString(),
            decoration: const InputDecoration(labelText: 'Merchant'),
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
