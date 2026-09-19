class CartModifierSelection {
  const CartModifierSelection({
    required this.id,
    required this.groupId,
    required this.groupName,
    required this.name,
    required this.priceDelta,
  });

  final String id;
  final String groupId;
  final String groupName;
  final String name;
  final double priceDelta;
}

class CartLine {
  CartLine({
    required this.productId,
    required this.name,
    required this.basePrice,
    this.description,
    this.imageUrl,
    this.quantity = 1,
    List<CartModifierSelection>? modifiers,
  }) : modifiers = modifiers ?? <CartModifierSelection>[];

  final String productId;
  final String name;
  final String? description;
  final String? imageUrl;
  final double basePrice;
  int quantity;
  final List<CartModifierSelection> modifiers;

  double get modifierUnitTotal => modifiers.fold<double>(0, (sum, item) => sum + item.priceDelta);
  double get unitPrice => basePrice + modifierUnitTotal;
  double get lineTotal => unitPrice * quantity;

  String get signature {
    final ids = modifiers.map((item) => item.id).toList()..sort();
    return '$productId:${ids.join(',')}';
  }

  String get modifierSummary => modifiers.map((item) => item.name).join(' · ');

  Map<String, dynamic> toOrderItem() => {
        'productId': productId,
        'quantity': quantity,
        if (modifiers.isNotEmpty) 'modifierOptionIds': modifiers.map((item) => item.id).toList(),
      };

  CartLine copy() => CartLine(
        productId: productId,
        name: name,
        description: description,
        imageUrl: imageUrl,
        basePrice: basePrice,
        quantity: quantity,
        modifiers: List<CartModifierSelection>.of(modifiers),
      );
}
