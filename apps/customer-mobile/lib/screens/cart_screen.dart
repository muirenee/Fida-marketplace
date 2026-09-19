import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../models/cart_line.dart';
import '../ui/format.dart';
import 'checkout_screen.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({
    super.key,
    required this.api,
    required this.merchant,
    required this.lines,
  });

  final ApiClient api;
  final Map<String, dynamic> merchant;
  final List<CartLine> lines;

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  final _promo = TextEditingController();
  bool _checkingPromo = false;
  String? _promoError;
  Map<String, dynamic>? _promoResult;

  String get _currency => widget.merchant['currency']?.toString() ?? 'RWF';
  double get _subtotal => widget.lines.fold(0, (sum, line) => sum + line.lineTotal);
  double get _discount => asDouble(_promoResult?['discount']);

  @override
  void dispose() {
    _promo.dispose();
    super.dispose();
  }

  void _changeQuantity(CartLine line, int delta) {
    setState(() {
      final next = line.quantity + delta;
      if (next <= 0) {
        widget.lines.remove(line);
      } else if (next <= 50) {
        line.quantity = next;
      }
      _promoResult = null;
      _promoError = null;
    });
    if (widget.lines.isEmpty) Navigator.pop(context);
  }

  Future<void> _applyPromo() async {
    final code = _promo.text.trim();
    if (code.isEmpty) {
      setState(() {
        _promoError = 'Enter a promo code.';
        _promoResult = null;
      });
      return;
    }
    setState(() {
      _checkingPromo = true;
      _promoError = null;
    });
    try {
      final result = await widget.api.validatePromo(
        tenantId: widget.merchant['id'].toString(),
        code: code,
        subtotal: _subtotal,
      );
      if (!mounted) return;
      setState(() => _promoResult = result);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _promoResult = null;
        _promoError = e.message;
      });
    } finally {
      if (mounted) setState(() => _checkingPromo = false);
    }
  }

  Future<void> _checkout() async {
    if (widget.lines.isEmpty) return;
    final minimum = asDouble(widget.merchant['minimumOrder']);
    if (_subtotal < minimum) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Minimum order is ${money(minimum, currency: _currency)}.')),
      );
      return;
    }

    final placed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CheckoutScreen(
          api: widget.api,
          merchant: widget.merchant,
          cartLines: widget.lines,
          promoCode: _promoResult == null ? null : _promo.text.trim(),
          promoEstimate: _promoResult,
        ),
      ),
    );
    if (placed == true && mounted) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final totalBeforeDelivery = (_subtotal - _discount).clamp(0, double.infinity);
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        leading: IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close_rounded, size: 30)),
        actions: [
          IconButton(onPressed: () {}, icon: const Icon(Icons.person_add_alt_1_outlined)),
          const SizedBox(width: 8),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 140),
        children: [
          Text(widget.merchant['name'].toString(), style: const TextStyle(fontSize: 31, fontWeight: FontWeight.w900, letterSpacing: -1.1)),
          const SizedBox(height: 22),
          for (final line in widget.lines) ...[
            _CartLineRow(
              line: line,
              currency: _currency,
              onMinus: () => _changeQuantity(line, -1),
              onPlus: () => _changeQuantity(line, 1),
            ),
            const SizedBox(height: 18),
          ],
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton.tonalIcon(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Add items'),
            ),
          ),
          const SizedBox(height: 22),
          const Divider(height: 1),
          const SizedBox(height: 16),
          const _OptionRow(icon: Icons.restaurant_outlined, label: 'Request utensils, etc.'),
          const SizedBox(height: 8),
          const _OptionRow(icon: Icons.note_alt_outlined, label: 'Add note'),
          const SizedBox(height: 22),
          const Divider(height: 1),
          const SizedBox(height: 22),
          Text('Promotions', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _promo,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(hintText: 'Enter promo code'),
                  onSubmitted: (_) => _applyPromo(),
                ),
              ),
              const SizedBox(width: 10),
              SizedBox(
                height: 54,
                child: FilledButton(
                  onPressed: _checkingPromo ? null : _applyPromo,
                  child: _checkingPromo
                      ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Apply'),
                ),
              ),
            ],
          ),
          if (_promoError != null) ...[
            const SizedBox(height: 8),
            Text(_promoError!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontWeight: FontWeight.w600)),
          ],
          if (_promoResult != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: const Color(0xFFE8F5EC), borderRadius: BorderRadius.circular(14)),
              child: Row(
                children: [
                  const Icon(Icons.local_offer_outlined, color: Color(0xFF0E7A3D)),
                  const SizedBox(width: 10),
                  Expanded(child: Text('Promo applied · You save ${money(_discount, currency: _currency)}', style: const TextStyle(fontWeight: FontWeight.w800))),
                ],
              ),
            ),
          ],
          const SizedBox(height: 26),
          _PriceRow(label: 'Subtotal', value: money(_subtotal, currency: _currency)),
          if (_discount > 0) _PriceRow(label: 'Promotion', value: '-${money(_discount, currency: _currency)}', green: true),
          const SizedBox(height: 8),
          _PriceRow(label: 'Before delivery', value: money(totalBeforeDelivery, currency: _currency), strong: true),
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(20, 8, 20, 18),
        child: SizedBox(
          height: 58,
          child: FilledButton(
            onPressed: _checkout,
            child: const Text('Go to checkout', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
          ),
        ),
      ),
    );
  }
}

class _CartLineRow extends StatelessWidget {
  const _CartLineRow({required this.line, required this.currency, required this.onMinus, required this.onPlus});

  final CartLine line;
  final String currency;
  final VoidCallback onMinus;
  final VoidCallback onPlus;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _ProductImage(url: line.imageUrl, size: 92),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(line.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              if (line.modifierSummary.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(line.modifierSummary, style: const TextStyle(color: Colors.black54)),
              ],
              const SizedBox(height: 5),
              Text(money(line.lineTotal, currency: currency), style: const TextStyle(fontSize: 16)),
            ],
          ),
        ),
        Container(
          decoration: BoxDecoration(color: const Color(0xFFF3F3F3), borderRadius: BorderRadius.circular(30)),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(onPressed: onMinus, icon: Icon(line.quantity == 1 ? Icons.delete_outline_rounded : Icons.remove_rounded), visualDensity: VisualDensity.compact),
              Text('${line.quantity}', style: const TextStyle(fontWeight: FontWeight.w800)),
              IconButton(onPressed: onPlus, icon: const Icon(Icons.add_rounded), visualDensity: VisualDensity.compact),
            ],
          ),
        ),
      ],
    );
  }
}

class _ProductImage extends StatelessWidget {
  const _ProductImage({required this.url, required this.size});
  final String? url;
  final double size;

  @override
  Widget build(BuildContext context) {
    final value = url?.trim();
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: value == null || value.isEmpty
          ? Container(width: size, height: size, color: const Color(0xFFF4F2EE), child: const Icon(Icons.fastfood_outlined, size: 34))
          : Image.network(
              value,
              width: size,
              height: size,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(width: size, height: size, color: const Color(0xFFF4F2EE), child: const Icon(Icons.fastfood_outlined)),
            ),
    );
  }
}

class _OptionRow extends StatelessWidget {
  const _OptionRow({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon),
      title: Text(label, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
      trailing: const Icon(Icons.chevron_right_rounded),
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({required this.label, required this.value, this.strong = false, this.green = false});
  final String label;
  final String value;
  final bool strong;
  final bool green;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(fontSize: strong ? 19 : 17, fontWeight: strong ? FontWeight.w900 : FontWeight.w500, color: green ? const Color(0xFF0E7A3D) : null);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(children: [Expanded(child: Text(label, style: style)), Text(value, style: style)]),
    );
  }
}
