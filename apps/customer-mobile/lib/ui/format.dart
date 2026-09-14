double asDouble(dynamic value) {
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? 0;
}

String money(dynamic value, {String currency = 'RWF'}) {
  final amount = asDouble(value);
  if (currency == 'RWF') return '${amount.round()} RWF';
  return '${amount.toStringAsFixed(2)} $currency';
}

String customerName(Map<String, dynamic>? user) {
  if (user == null) return '';
  final first = (user['firstName'] ?? '').toString().trim();
  final last = (user['lastName'] ?? '').toString().trim();
  final name = '$first $last'.trim();
  return name.isNotEmpty ? name : (user['email'] ?? user['phone'] ?? 'Customer').toString();
}
