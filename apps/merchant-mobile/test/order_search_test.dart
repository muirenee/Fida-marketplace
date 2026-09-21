import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_mobile/api_client.dart';
import 'package:merchant_mobile/main.dart';

class SearchApi extends MerchantApiClient {
  final calls = <({String? status, String? search})>[];
  Completer<List<Map<String, dynamic>>>? delayed;
  @override
  Future<List<Map<String, dynamic>>> orders(String tenantId, {String? status, String? search}) async {
    calls.add((status: status, search: search));
    if (search == 'old') return (delayed = Completer<List<Map<String, dynamic>>>()).future;
    return [];
  }
}

void main() {
  testWidgets('search debounces, sends names/numbers and clears without accepting stale results', (tester) async {
    final api = SearchApi();
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: MerchantOrdersPage(api: api, tenantId: 'store'))));
    await tester.pumpAndSettle();
    final field = find.byKey(const ValueKey('merchant-order-search'));
    await tester.enterText(field, 'FM-20260921');
    await tester.pump(const Duration(milliseconds: 100));
    expect(api.calls.length, 1);
    await tester.enterText(field, 'Alice Smith');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(api.calls.last.search, 'Alice Smith');
    expect(find.textContaining('No matching orders'), findsOneWidget);
    await tester.enterText(field, 'old');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.enterText(field, 'FM-20260921');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(api.calls.last.search, 'FM-20260921');
    api.delayed!.complete([{'id':'stale','orderNumber':'STALE ORDER','status':'COMPLETED'}]);
    await tester.pumpAndSettle();
    expect(find.text('STALE ORDER'), findsNothing);
    await tester.tap(find.byTooltip('Clear search'));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(api.calls.last.search, '');
    expect(find.text('No orders in this queue.'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
}
