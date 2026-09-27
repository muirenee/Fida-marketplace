import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:fida_mobile_common/fida_mobile_common.dart';
import 'package:customer_mobile/core/api_client.dart';
import 'package:customer_mobile/screens/delivery_pin_screen.dart';
import 'package:customer_mobile/screens/checkout_screen.dart';
import 'package:customer_mobile/screens/marketplace_screen.dart';

void main(){
 TestWidgetsFlutterBinding.ensureInitialized();
 FlutterSecureStorage.setMockInitialValues({});
 test('optional amounts omit zero without losing nonzero or negative fees',(){
  for(final v in [null,0,0.0,'0','0.00','0 RWF','-0.00',double.nan,double.infinity])expect(hasNonZeroAmount(v),false,reason:'$v');
  for(final v in [1,-1,'0.01','-20 RWF'])expect(hasNonZeroAmount(v),true,reason:'$v');
  expect(promotionDescription({'discountType':'BOGO'},'RWF'),'Buy 1, get 1 free');
 });
 testWidgets('pin tap and drag reverse-geocode only the latest point and preserve manual edits',(tester)async{
  final pending=<Completer<({String address,String city})>>[];
  await tester.pumpWidget(MaterialApp(home:DeliveryPinScreen(showTiles:false,reverse:(lat,lon){final c=Completer<({String address,String city})>();pending.add(c);return c.future;})));
  await tester.tapAt(tester.getTopLeft(find.byType(FlutterMap))+const Offset(100,100));
  await tester.pump(const Duration(seconds:1));expect(pending.length,1);
  await tester.drag(find.byKey(const ValueKey('delivery-pin')),const Offset(30,20));
  await tester.pump(const Duration(seconds:1));expect(pending.length,2);
  pending[0].complete((address:'Old address',city:'Old city'));await tester.pump();
  expect(find.text('Old address'),findsNothing);
  await tester.enterText(find.byKey(const ValueKey('pin-address')),'Entrance beside shop');
  pending[1].complete((address:'New street',city:'Kigali'));await tester.pumpAndSettle();
  expect(find.text('Entrance beside shop'),findsOneWidget);expect(find.text('Kigali'),findsOneWidget);
  expect(tester.takeException(),isNull);
 });
 testWidgets('reverse-geocoding failure leaves a usable pin and manual address',(tester)async{
  Map<String,dynamic>? result;
  await tester.pumpWidget(MaterialApp(home:Builder(builder:(context)=>Scaffold(body:TextButton(onPressed:()async{result=await Navigator.push<Map<String,dynamic>>(context,MaterialPageRoute(builder:(_)=>DeliveryPinScreen(showTiles:false,reverse:(_,__)async=>throw StateError('offline'))));},child:const Text('Open'))))));
  await tester.tap(find.text('Open'));await tester.pumpAndSettle();
  await tester.tapAt(tester.getTopLeft(find.byType(FlutterMap))+const Offset(80,80));
  await tester.pump(const Duration(seconds:1));await tester.pumpAndSettle();
  expect(find.textContaining('Address lookup unavailable'),findsOneWidget);
  await tester.enterText(find.byKey(const ValueKey('pin-address')),'KG 10 Street');
  await tester.tap(find.text('Use this delivery location'));await tester.pumpAndSettle();
  expect(result?['addressLine'],'KG 10 Street');expect(result?['latitude'],isA<double>());expect(result?['longitude'],isA<double>());
 });
 testWidgets('BOGO stores appear in their own row and zero checkout fees stay hidden',(tester)async{
  final store=<String,dynamic>{'id':'t','slug':'store','name':'Pair Kitchen','currency':'RWF','branches':[{'id':'b','name':'Central','pickupEnabled':true,'deliveryEnabled':true,'isOpen':true,'deliveryZones':[]}],'promotions':[{'discountType':'BOGO','productId':'p'}]};
  final api=ApiClient(client:MockClient((r)async=>http.Response(jsonEncode(r.url.path.endsWith('/merchants')?[store]:r.url.path.endsWith('/methods')?{'methods':['CASH']}:r.url.path.endsWith('/checkout-preview')?{'subtotal':1000,'deliveryFee':0,'itemDiscount':0,'cartDiscount':0,'tax':0,'taxLabel':'VAT','taxPercent':0,'total':1000}:[]),200)));
  await tester.pumpWidget(MaterialApp(theme:fidaTheme(),home:Scaffold(body:MarketplaceScreen(api:api))));await tester.pumpAndSettle();
  expect(find.text('Buy 1, get 1 free'),findsWidgets);
  await tester.pumpWidget(MaterialApp(theme:fidaTheme(),home:CheckoutScreen(api:api,merchant:store,cart:const {'p':1},products:const {'p':{'id':'p','name':'Rice','price':1000}},initialFulfillment:'PICKUP')));await tester.pumpAndSettle();
  await tester.scrollUntilVisible(find.text('Subtotal'),300,scrollable:find.byType(Scrollable).first);await tester.pumpAndSettle();
  expect(find.text('Subtotal'),findsOneWidget);expect(find.text('Total'),findsOneWidget);
  expect(find.text('Item discounts'),findsNothing);expect(find.text('Promo discount'),findsNothing);expect(find.text('VAT (0%)'),findsNothing);
  expect(tester.takeException(),isNull);api.close();
 });
}
