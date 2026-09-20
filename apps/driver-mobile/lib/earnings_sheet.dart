import 'package:flutter/material.dart';

class EarningsSheet extends StatelessWidget {
  const EarningsSheet({super.key, required this.rows});
  final List<dynamic> rows;

  String currency(Map row) => (row['payoutCurrency'] ?? row['order']?['tenant']?['currency'] ?? 'RWF').toString();
  double? number(Object? value) => value == null ? null : double.tryParse('$value');
  String amount(double value, String unit) => '${value.toStringAsFixed(value == value.roundToDouble() ? 0 : 2)} $unit';
  String date(Object? value) {
    final parsed = DateTime.tryParse('$value')?.toLocal();
    if (parsed == null) return 'Date unavailable';
    return '${parsed.day.toString().padLeft(2, '0')}/${parsed.month.toString().padLeft(2, '0')}/${parsed.year} ${parsed.hour.toString().padLeft(2, '0')}:${parsed.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final paid = <String, double>{};
    for (final row in rows) {
      final value = number(row['settledPayout']);
      if (value != null) paid.update(currency(row), (old) => old + value, ifAbsent: () => value);
    }
    return SafeArea(
      top: false,
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * .85,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
          children: [
            Row(children: [const Expanded(child: Text('Delivery earnings', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800))), IconButton(tooltip: 'Close', onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close))]),
            const Text('Payments recorded by your delivery operator. Estimates are shown separately until payment is recorded.'),
            for (final entry in paid.entries) Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Text('Recorded paid: ${amount(entry.value, entry.key)}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700))),
            if (rows.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text('No completed deliveries yet.')),
            for (final raw in rows) _row(context, raw as Map),
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext context, Map row) {
    final settled = number(row['settledPayout']), estimate = number(row['estimatedPayout']);
    final value = settled ?? estimate;
    final status = settled != null ? 'Payment recorded' : estimate != null ? 'Agreed estimate · awaiting payment' : 'Awaiting operator reconciliation';
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 18),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0xFFE5E5E5)))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('${row['order']?['orderNumber'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text(date(row['deliveredAt'])),
        const SizedBox(height: 10),
        Text(value == null ? 'No historical pay record' : amount(value, currency(row)), style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800)),
        Text(status, style: TextStyle(color: settled != null ? const Color(0xFF07855A) : Colors.black54)),
        if (row['settlementReference'] != null) Text('Receipt: ${row['settlementReference']}'),
      ]),
    );
  }
}
