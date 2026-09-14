import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/session_controller.dart';
import '../ui/format.dart';
import 'marketplace_screen.dart';
import 'orders_screen.dart';

class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key, required this.api, required this.session});

  final ApiClient api;
  final SessionController session;

  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final titles = ['Marketplace', 'My orders', 'Account'];
    return Scaffold(
      appBar: AppBar(
        title: Text(titles[_index], style: const TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          if (_index == 0)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: CircleAvatar(
                child: Text(
                  customerName(widget.session.user).isEmpty
                      ? 'F'
                      : customerName(widget.session.user).substring(0, 1).toUpperCase(),
                ),
              ),
            ),
        ],
      ),
      body: IndexedStack(
        index: _index,
        children: [
          MarketplaceScreen(api: widget.api),
          OrdersScreen(api: widget.api),
          _AccountScreen(session: widget.session),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.storefront_outlined), selectedIcon: Icon(Icons.storefront_rounded), label: 'Browse'),
          NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long_rounded), label: 'Orders'),
          NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'Account'),
        ],
      ),
    );
  }
}

class _AccountScreen extends StatelessWidget {
  const _AccountScreen({required this.session});

  final SessionController session;

  @override
  Widget build(BuildContext context) {
    final user = session.user ?? {};
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Center(
          child: CircleAvatar(
            radius: 42,
            child: Text(
              customerName(user).isEmpty ? 'F' : customerName(user).substring(0, 1).toUpperCase(),
              style: Theme.of(context).textTheme.headlineMedium,
            ),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          customerName(user),
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
        ),
        if (user['email'] != null)
          Text(user['email'].toString(), textAlign: TextAlign.center),
        const SizedBox(height: 28),
        const Card(
          child: Column(
            children: [
              ListTile(
                leading: Icon(Icons.location_on_outlined),
                title: Text('Delivery addresses'),
                subtitle: Text('Saved addresses are available during checkout'),
              ),
              Divider(height: 1),
              ListTile(
                leading: Icon(Icons.support_agent_rounded),
                title: Text('Support'),
                subtitle: Text('Support workflow will be added in the next service milestone'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        OutlinedButton.icon(
          onPressed: session.busy ? null : session.logout,
          icon: const Icon(Icons.logout_rounded),
          label: const Padding(
            padding: EdgeInsets.symmetric(vertical: 13),
            child: Text('Sign out'),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          'API: ${ApiClient.baseUrl}',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}
