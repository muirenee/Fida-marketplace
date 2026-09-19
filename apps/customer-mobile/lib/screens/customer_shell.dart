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
    return Scaffold(
      appBar: _index == 0
          ? null
          : AppBar(
              title: Text(
                _index == 1 ? 'Orders' : 'Account',
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 28),
              ),
            ),
      body: IndexedStack(
        index: _index,
        children: [
          MarketplaceScreen(api: widget.api),
          OrdersScreen(api: widget.api),
          _AccountScreen(session: widget.session),
        ],
      ),
      bottomNavigationBar: ColoredBox(
        color: Colors.white,
        child: SafeArea(
          top: false,
          child: Container(
            margin: const EdgeInsets.fromLTRB(18, 4, 18, 12),
            height: 68,
            padding: const EdgeInsets.symmetric(horizontal: 9),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(35),
              border: Border.all(color: const Color(0xFFE7E7E7)),
              boxShadow: const [BoxShadow(blurRadius: 18, color: Color(0x18000000), offset: Offset(0, 5))],
            ),
            child: Row(
              children: [
                Expanded(
                  child: _NavItem(
                    icon: Icons.home_outlined,
                    selectedIcon: Icons.home_rounded,
                    label: 'Home',
                    selected: _index == 0,
                    onTap: () => setState(() => _index = 0),
                  ),
                ),
                Expanded(
                  child: _NavItem(
                    icon: Icons.receipt_long_outlined,
                    selectedIcon: Icons.receipt_long_rounded,
                    label: 'Orders',
                    selected: _index == 1,
                    onTap: () => setState(() => _index = 1),
                  ),
                ),
                Expanded(
                  child: _NavItem(
                    icon: Icons.person_outline_rounded,
                    selectedIcon: Icons.person_rounded,
                    label: 'Account',
                    selected: _index == 2,
                    onTap: () => setState(() => _index = 2),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({required this.icon, required this.selectedIcon, required this.label, required this.selected, required this.onTap});

  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(30),
      onTap: onTap,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(selected ? selectedIcon : icon, size: 25, color: Colors.black),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 11.5, fontWeight: selected ? FontWeight.w900 : FontWeight.w600)),
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
        title: const Text('Phone number'),
        content: Form(
          key: formKey,
          child: TextFormField(
            initialValue: phoneValue,
            autofocus: true,
            keyboardType: TextInputType.phone,
            onChanged: (value) => phoneValue = value.trim(),
            decoration: const InputDecoration(hintText: '+250 7xx xxx xxx'),
            validator: (value) {
              final digits = (value ?? '').replaceAll(RegExp(r'\D'), '');
              return digits.length >= 7 && digits.length <= 15 ? null : 'Enter a valid phone number';
            },
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              if (formKey.currentState?.validate() == true) Navigator.pop(dialogContext, phoneValue);
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
      SnackBar(content: Text(ok ? 'Phone number updated.' : (widget.session.error ?? 'Unable to update phone number.'))),
    );
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.session.user ?? {};
    final name = customerName(user);
    final phone = user['phone']?.toString();
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
      children: [
        Row(
          children: [
            CircleAvatar(
              radius: 36,
              backgroundColor: Colors.black,
              foregroundColor: Colors.white,
              child: Text(
                name.isEmpty ? 'F' : name.substring(0, 1).toUpperCase(),
                style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name.isEmpty ? 'Fida customer' : name, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
                  if (user['email'] != null) Text(user['email'].toString(), style: const TextStyle(color: Colors.black54)),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 28),
        _AccountTile(
          icon: Icons.phone_outlined,
          title: 'Phone number',
          subtitle: phone == null || phone.isEmpty ? 'Required before placing an order' : phone,
          onTap: widget.session.busy ? null : _editPhone,
          warning: phone == null || phone.isEmpty,
        ),
        const _AccountTile(icon: Icons.location_on_outlined, title: 'Addresses', subtitle: 'Manage delivery locations'),
        const _AccountTile(icon: Icons.payments_outlined, title: 'Payments', subtitle: 'Payment methods and receipts'),
        const _AccountTile(icon: Icons.local_offer_outlined, title: 'Promotions', subtitle: 'Promo codes and offers'),
        const _AccountTile(icon: Icons.support_agent_rounded, title: 'Help', subtitle: 'Order and account support'),
        const SizedBox(height: 24),
        SizedBox(
          height: 54,
          child: FilledButton.tonalIcon(
            onPressed: widget.session.busy ? null : widget.session.logout,
            icon: const Icon(Icons.logout_rounded),
            label: const Text('Sign out'),
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFF1F1F1), foregroundColor: Colors.black),
          ),
        ),
      ],
    );
  }
}

class _AccountTile extends StatelessWidget {
  const _AccountTile({required this.icon, required this.title, required this.subtitle, this.onTap, this.warning = false});

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  final bool warning;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(vertical: 4),
      onTap: onTap,
      leading: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(color: const Color(0xFFF1F1F1), borderRadius: BorderRadius.circular(12)),
        child: Icon(icon, color: warning ? Theme.of(context).colorScheme.error : Colors.black),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.chevron_right_rounded),
    );
  }
}
