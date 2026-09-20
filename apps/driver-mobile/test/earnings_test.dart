import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:driver_mobile/earnings_sheet.dart';

void main() {
  testWidgets('history separates recorded payments, estimates and missing historical data', (tester) async {
    tester.view.physicalSize=const Size(390,844);
    tester.view.devicePixelRatio=1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final rows=[
      {'order':{'orderNumber':'FM-PAID'},'settledPayout':'1502','estimatedPayout':'1600','payoutCurrency':'RWF','deliveredAt':'2026-09-20T07:25:36Z','settlementReference':'receipt-123'},
      {'order':{'orderNumber':'FM-ESTIMATE'},'estimatedPayout':'1200','payoutCurrency':'RWF','deliveredAt':'2026-09-19T07:25:36Z'},
      {'order':{'orderNumber':'FM-LEGACY'},'deliveredAt':'2026-09-18T07:25:36Z'},
    ];
    await tester.pumpWidget(MaterialApp(home:Builder(builder:(context)=>Scaffold(body:Center(child:TextButton(onPressed:()=>showModalBottomSheet(context:context,isScrollControlled:true,useSafeArea:true,builder:(_)=>EarningsSheet(rows:rows)),child:const Text('Open history')))))));
    await tester.tap(find.text('Open history'));await tester.pumpAndSettle();
    expect(find.text('Recorded paid: 1502 RWF'),findsOneWidget);
    expect(find.text('1502 RWF'),findsOneWidget);
    expect(find.text('1600 RWF'),findsNothing);
    await tester.scrollUntilVisible(find.text('Awaiting operator reconciliation'),200);
    expect(find.text('No historical pay record'),findsOneWidget);
    expect(find.text('Not configured'),findsNothing);
    expect(tester.takeException(),isNull);
  });
}
