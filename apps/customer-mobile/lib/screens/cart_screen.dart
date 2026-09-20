import 'package:flutter/material.dart';
import 'package:fida_mobile_common/fida_mobile_common.dart';
import '../core/api_client.dart';
import '../ui/format.dart';
import 'checkout_screen.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({
    super.key,
    required this.api,
    required this.merchant,
    required this.cart,
    required this.products,
    required this.fulfillment,
  });
  final ApiClient api;
  final Map<String, dynamic> merchant;
  final Map<String, int> cart;
  final Map<String, Map<String, dynamic>> products;
  final String fulfillment;
  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  bool utensils = false;
  final notes = TextEditingController();
  @override
  void dispose() {
    notes.dispose();
    super.dispose();
  }

  double get subtotal => widget.cart.entries.fold(
    0,
    (sum, e) => sum + asDouble(widget.products[e.key]?['price']) * e.value,
  );
  void change(String key, int delta) => setState(() {
    final next = (widget.cart[key] ?? 0) + delta;
    if (next <= 0) {
      widget.cart.remove(key);
    } else if (next <= 50) {
      widget.cart[key] = next;
    }
  });
  @override
  Widget build(BuildContext context) {
    final currency = widget.merchant['currency']?.toString() ?? 'RWF';
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Back to menu',
          onPressed: () => Navigator.pop(context),
          icon: const Icon(Icons.close),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            widget.merchant['name'].toString(),
            style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 24),
          if (widget.cart.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 50),
              child: Center(
                child: Text('Your cart is empty. Find something delicious.'),
              ),
            ),
          for (final e in widget.cart.entries)
            Padding(
              padding: const EdgeInsets.only(bottom: 22),
              child: Column(
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ProductPhoto(
                        url: widget.products[e.key]?['imageUrl']?.toString(),
                        baseUrl: ApiClient.baseUrl,
                        size: 74,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.products[e.key]?['name'].toString() ?? '',
                              style: const TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              money(
                                widget.products[e.key]?['price'],
                                currency: currency,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: QuantityControl(
                      value: e.value,
                      onMinus: () => change(e.key, -1),
                      onPlus: e.value >= 50 ? null : () => change(e.key, 1),
                    ),
                  ),
                ],
              ),
            ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.add),
              label: const Text('Add items'),
            ),
          ),
          const Divider(height: 32),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Request utensils, etc.'),
            secondary: const Icon(Icons.restaurant),
            value: utensils,
            onChanged: (v) => setState(() => utensils = v ?? false),
          ),
          TextField(
            controller: notes,
            maxLength: 500,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Order note',
              hintText: 'Anything the merchant should know?',
            ),
          ),
          const Divider(height: 32),
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Subtotal',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                ),
              ),
              Text(
                money(subtotal, currency: currency),
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Delivery, discounts and tax are confirmed at checkout.',
            style: TextStyle(color: Colors.black54),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.all(16),
        child: FilledButton(
          onPressed: widget.cart.isEmpty
              ? null
              : () async {
                  if (subtotal < asDouble(widget.merchant['minimumOrder'])) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          'Minimum order: ${money(widget.merchant['minimumOrder'], currency: currency)}',
                        ),
                      ),
                    );
                    return;
                  }
                  final placed = await Navigator.push<bool>(
                    context,
                    MaterialPageRoute(
                      builder: (_) => CheckoutScreen(
                        api: widget.api,
                        merchant: widget.merchant,
                        cart: Map.of(widget.cart),
                        products: Map.of(widget.products),
                        initialFulfillment: widget.fulfillment,
                        orderNote: [
                          if (utensils) 'Please include utensils.',
                          if (notes.text.trim().isNotEmpty) notes.text.trim(),
                        ].join(' '),
                      ),
                    ),
                  );
                  if (placed == true && context.mounted)
                    Navigator.pop(context, true);
                },
          child: const Padding(
            padding: EdgeInsets.symmetric(vertical: 15),
            child: Text(
              'Go to checkout',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
          ),
        ),
      ),
    );
  }
}
