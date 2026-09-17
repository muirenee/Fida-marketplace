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
    final titles = ['Home', 'Orders', 'Account'];
    return Scaffold(
      appBar: _index == 0
          ? null
          : AppBar(
              title: Text(titles[_index], style: const TextStyle(fontWeight: FontWeight.w900)),
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
        height: 72,
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Home'),
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
    final name = customerName(user);
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
      children: [
        Row(
          children: [
            CircleAvatar(
              radius: 34,
              backgroundColor: const Color(0xFFE2F3EC),
              foregroundColor: const Color(0xFF176B55),
              child: Text(
                name.isEmpty ? 'F' : name.substring(0, 1).toUpperCase(),
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name.isEmpty ? 'Fida customer' : name,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                  ),
                  if (user['email'] != null)
                    Text(user['email'].toString(), style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 26),
        const _AccountTile(
          icon: Icons.location_on_outlined,
          title: 'Delivery addresses',
          subtitle: 'Saved addresses are available during checkout',
        ),
        const SizedBox(height: 10),
        const _AccountTile(
          icon: Icons.support_agent_rounded,
          title: 'Support',
          subtitle: 'Help and order support will appear here',
        ),
        const SizedBox(height: 10),
        const _AccountTile(
          icon: Icons.payments_outlined,
          title: 'Payments',
          subtitle: 'Cash today; more payment methods can be added later',
        ),
        const SizedBox(height: 26),
        FilledButton.tonalIcon(
          onPressed: session.busy ? null : session.logout,
          icon: const Icon(Icons.logout_rounded),
          label: const Padding(
            padding: EdgeInsets.symmetric(vertical: 13),
            child: Text('Sign out'),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          'Fida Marketplace',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.black54),
        ),
      ],
    );
  }
}

class _AccountTile extends StatelessWidget {
  const _AccountTile({required this.icon, required this.title, required this.subtitle});

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF6F7F6),
        borderRadius: BorderRadius.circular(16),
      ),
      child: ListTile(
        leading: Icon(icon, color: const Color(0xFF176B55)),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right_rounded),
      ),
    );
  }
}
