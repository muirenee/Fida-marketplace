import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:driver_mobile/delivery_route_summary.dart';
void main(){
 testWidgets('route and payment remain readable at large text sizes',(tester)async{
  tester.view.physicalSize=const Size(360,800);tester.view.devicePixelRatio=1;addTearDown(tester.view.resetPhysicalSize);addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(MaterialApp(home:MediaQuery(data:const MediaQueryData(textScaler:TextScaler.linear(1.6)),child:Scaffold(body:SingleChildScrollView(child:DeliveryRouteSummary(order:{'tenant':{'name':'Long restaurant name in Kigali','currency':'RWF'},'branch':{'addressLine':'KK 31 Avenue','city':'Kigali'},'deliveryAddress':'Apartment entrance behind the community centre','paymentMethod':'CASH','paymentStatus':'PAID','total':'15000'}))))));
  expect(find.text('1 · Pickup'),findsOneWidget);expect(find.text('2 · Drop-off'),findsOneWidget);expect(find.text('Paid'),findsOneWidget);expect(find.text('Payment pending'),findsNothing);expect(tester.takeException(),isNull);
 });
}
