import 'addresses_screen.dart';
import 'saved_screen.dart';

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
              title: Text(
                titles[_index],
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
      body: IndexedStack(
        index: _index,
        children: [
          MarketplaceScreen(
            api: widget.api,
            onAccount: () => setState(() => _index = 2),
          ),
          OrdersScreen(api: widget.api),
          _AccountScreen(session: widget.session),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        height: 72,
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long_rounded),
            label: 'Orders',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'Account',
          ),
        ],
      ),
    );
  }
}

class _AccountScreen extends StatefulWidget {
  const _AccountScreen({required this.session});

  final SessionController session;

  @override
  State<_AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<_AccountScreen> {
  Future<void> _editPhone() async {
    String phoneValue = widget.session.user?['phone']?.toString() ?? '';
    final formKey = GlobalKey<FormState>();
    final value = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Customer phone number'),
        content: Form(
          key: formKey,
          child: TextFormField(
            initialValue: phoneValue,
            autofocus: true,
            keyboardType: TextInputType.phone,
            onChanged: (value) => phoneValue = value.trim(),
            decoration: const InputDecoration(
              labelText: 'Phone number',
              hintText: '+250 7xx xxx xxx',
              border: OutlineInputBorder(),
            ),
            validator: (value) {
              final digits = (value ?? '').replaceAll(RegExp(r'\D'), '');
              return digits.length >= 7 && digits.length <= 15
                  ? null
                  : 'Enter a valid phone number';
            },
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              if (formKey.currentState?.validate() == true)
                Navigator.pop(dialogContext, phoneValue);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (value == null || value.isEmpty) return;

    final ok = await widget.session.updatePhone(value);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? 'Phone number updated.'
              : (widget.session.error ?? 'Unable to update phone number.'),
        ),
      ),
    );
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.session.user ?? {};
    final name = customerName(user);
    final phone = user['phone']?.toString();

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
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name.isEmpty ? 'Fida customer' : name,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  if (user['email'] != null)
                    Text(
                      user['email'].toString(),
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  if (phone != null && phone.isNotEmpty)
                    Text(phone, style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 26),
        _AccountTile(
          icon: Icons.phone_outlined,
          title: 'Phone number',
          subtitle: phone == null || phone.isEmpty
              ? 'Required before placing an order'
              : phone,
          onTap: widget.session.busy ? null : _editPhone,
          warning: phone == null || phone.isEmpty,
        ),
        const SizedBox(height: 10),
        _AccountTile(
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => AddressesScreen(api: widget.session.api),
            ),
          ),
          icon: Icons.location_on_outlined,
          title: 'Delivery addresses',
          subtitle: 'Saved addresses are available during checkout',
        ),
        const SizedBox(height: 10),
        _AccountTile(
          icon: Icons.support_agent_rounded,
          title: 'Support',
          subtitle: 'View your order support cases',
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) =>
                  SavedScreen(api: widget.session.api, support: true),
            ),
          ),
        ),
        const SizedBox(height: 10),
        _AccountTile(
          icon: Icons.favorite_outline,
          title: 'Favourites',
          subtitle: 'Your saved merchants',
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => SavedScreen(api: widget.session.api),
            ),
          ),
        ),
        const SizedBox(height: 10),
        const _AccountTile(
          icon: Icons.payments_outlined,
          title: 'Payments',
          subtitle: 'Available payment methods are shown at checkout',
        ),
        const SizedBox(height: 26),
        FilledButton.tonalIcon(
          onPressed: widget.session.busy ? null : widget.session.logout,
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
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: Colors.black54),
        ),
      ],
    );
  }
}

class _AccountTile extends StatelessWidget {
  const _AccountTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
    this.warning = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  final bool warning;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF6F7F6),
        borderRadius: BorderRadius.circular(16),
      ),
      child: ListTile(
        onTap: onTap,
        leading: Icon(
          icon,
          color: warning
              ? Theme.of(context).colorScheme.error
              : const Color(0xFF176B55),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text(subtitle),
        trailing: onTap == null
            ? null
            : const Icon(Icons.chevron_right_rounded),
      ),
    );
  }
}
