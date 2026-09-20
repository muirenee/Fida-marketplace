import 'package:flutter/material.dart';
import 'package:fida_mobile_common/fida_mobile_common.dart';
import '../core/api_client.dart';
import '../ui/format.dart';

class ProductScreen extends StatefulWidget {
  const ProductScreen({
    super.key,
    required this.product,
    required this.currency,
  });
  final Map<String, dynamic> product;
  final String currency;
  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> {
  final Set<String> selected = {};
  int quantity = 1;
  List<Map> get options =>
      (widget.product['options'] as List? ?? []).cast<Map>();
  Map<String, List<Map>> get groups {
    final result = <String, List<Map>>{};
    for (final o in options) {
      (result[o['group']?.toString() ?? 'Extras'] ??= []).add(o);
    }
    return result;
  }

  bool get valid => groups.values.every((rows) {
    final count = rows.where((o) => selected.contains(o['name'])).length;
    return count >= (rows.first['minSelect'] as num? ?? 0) &&
        count <= (rows.first['maxSelect'] as num? ?? rows.length);
  });
  double get price =>
      asDouble(widget.product['price']) +
      options
          .where((o) => selected.contains(o['name']))
          .fold<double>(0, (sum, o) => sum + asDouble(o['price']));
  @override
  Widget build(BuildContext context) => Scaffold(
    body: CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 260,
          pinned: true,
          backgroundColor: Colors.white,
          leading: Padding(
            padding: const EdgeInsets.all(5),
            child: IconButton.filledTonal(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.close),
            ),
          ),
          flexibleSpace: FlexibleSpaceBar(
            background: FoodCover(
              url: widget.product['imageUrl']?.toString(),
              baseUrl: ApiClient.baseUrl,
              height: 300,
              radius: 0,
              label: widget.product['name'].toString(),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.product['name'].toString(),
                  style: const TextStyle(
                    fontSize: 29,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -.6,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  money(widget.product['price'], currency: widget.currency),
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if ((widget.product['description'] ?? '').toString().isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      widget.product['description'].toString(),
                      style: const TextStyle(
                        color: Colors.black54,
                        fontSize: 16,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        for (final group in groups.entries)
          SliverToBoxAdapter(
            child: Container(
              decoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(color: Color(0xFFF3F3F3), width: 8),
                ),
              ),
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          group.key,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      if ((group.value.first['minSelect'] as num? ?? 0) > 0)
                        const Chip(
                          label: Text('Required'),
                          backgroundColor: Color(0xFFE4F3EB),
                        ),
                    ],
                  ),
                  Text(
                    'Choose ${group.value.first['minSelect'] ?? 0}–${group.value.first['maxSelect'] ?? group.value.length}',
                    style: const TextStyle(color: Colors.black54),
                  ),
                  for (final option in group.value)
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.trailing,
                      title: Text(option['name'].toString()),
                      subtitle: asDouble(option['price']) == 0
                          ? null
                          : Text(
                              '+ ${money(option['price'], currency: widget.currency)}',
                            ),
                      value: selected.contains(option['name']),
                      onChanged: (value) => setState(() {
                        final max =
                            (option['maxSelect'] as num? ?? group.value.length)
                                .toInt();
                        if (value != true) {
                          selected.remove(option['name']);
                          return;
                        }
                        if (max == 1)
                          selected.removeAll(
                            group.value.map((o) => o['name'].toString()),
                          );
                        if (group.value
                                .where((o) => selected.contains(o['name']))
                                .length <
                            max)
                          selected.add(option['name'].toString());
                      }),
                    ),
                ],
              ),
            ),
          ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Center(
              child: QuantityControl(
                value: quantity,
                onMinus: quantity > 1 ? () => setState(() => quantity--) : null,
                onPlus: quantity < 50 ? () => setState(() => quantity++) : null,
              ),
            ),
          ),
        ),
      ],
    ),
    bottomNavigationBar: SafeArea(
      minimum: const EdgeInsets.all(16),
      child: FilledButton(
        onPressed: valid
            ? () {
                final choices = selected.toList()..sort();
                Navigator.pop(context, {
                  'product': {
                    ...widget.product,
                    'productId': widget.product['id'],
                    'selectedOptions': choices,
                    'price': price,
                    'name':
                        '${widget.product['name']}${choices.isEmpty ? '' : ' (${choices.join(', ')})'}',
                  },
                  'quantity': quantity,
                });
              }
            : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 15),
          child: Text(
            valid
                ? 'Add $quantity to cart · ${money(price * quantity, currency: widget.currency)}'
                : 'Select required choices',
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
          ),
        ),
      ),
    ),
  );
}
