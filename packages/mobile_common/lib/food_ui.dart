import 'runtime_config.dart';
import 'package:flutter/material.dart';

class FoodCover extends StatelessWidget {
  const FoodCover({
    super.key,
    this.url,
    required this.baseUrl,
    this.height = 180,
    this.radius = 16,
    this.label = 'Fresh finds',
    this.emoji = '🍲',
  });
  final String? url;
  final String baseUrl, label, emoji;
  final double height, radius;
  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      color: const Color(0xFFEAF3DF),
      alignment: Alignment.center,
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: height < 100
              ? const Icon(Icons.storefront_outlined, size: 36, color: Color(0xFF28563E))
              : SizedBox(
                  width: 220,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(emoji, style: const TextStyle(fontSize: 64)),
                      const SizedBox(height: 8),
                      Text(label, maxLines: 2, overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF28563E))),
                    ],
                  ),
                ),
        ),
      ),
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: url == null || url!.isEmpty
            ? fallback
            : ValueListenableBuilder<int>(valueListenable:FidaEndpoints.changes,builder:(_,__,___)=>Image.network(
                FidaEndpoints.mediaUri(baseUrl, url!),
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => fallback,
              )),
      ),
    );
  }
}

class QuantityControl extends StatelessWidget {
  const QuantityControl({
    super.key,
    required this.value,
    required this.onMinus,
    required this.onPlus,
  });
  final int value;
  final VoidCallback? onMinus, onPlus;
  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: const Color(0xFFF3F3F3),
      borderRadius: BorderRadius.circular(30),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          tooltip: value == 1 ? 'Remove item' : 'Decrease quantity',
          onPressed: onMinus,
          icon: Icon(value == 1 ? Icons.delete_outline : Icons.remove),
        ),
        Text('$value', style: const TextStyle(fontWeight: FontWeight.w700)),
        IconButton(
          tooltip: 'Increase quantity',
          onPressed: onPlus,
          icon: const Icon(Icons.add),
        ),
      ],
    ),
  );
}

class SectionHeading extends StatelessWidget {
  const SectionHeading(this.title, {super.key, this.subtitle, this.action});
  final String title;
  final String? subtitle;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 16),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -.5,
                ),
              ),
              if (subtitle != null)
                Padding(
                  padding: const EdgeInsets.only(top: 5),
                  child: Text(
                    subtitle!,
                    style: const TextStyle(color: Colors.black54),
                  ),
                ),
            ],
          ),
        ),
        if (action != null) action!,
      ],
    ),
  );
}

String promotionDescription(Map promo, String currency) {
  final value = promo['discountType'] == 'FLAT' ? '${promo['flatAmount']} $currency' : '${promo['percent']}%';
  return promo['productId'] == null ? '$value off · Use ${promo['code']}' : '$value off selected item · Applied at checkout';
}
