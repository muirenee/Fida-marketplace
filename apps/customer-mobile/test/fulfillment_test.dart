import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:customer_mobile/core/api_client.dart';
import 'package:customer_mobile/screens/checkout_screen.dart';
import 'package:customer_mobile/screens/product_screen.dart';
import 'package:customer_mobile/ui/fulfillment.dart';
void main(){
 TestWidgetsFlutterBinding.ensureInitialized();FlutterSecureStorage.setMockInitialValues({});
 test('markup belongs to delivery only and Dine Out branches remain selectable',(){
  for(final mode in fulfillmentModes)expect(menuPrice('1180',{'deliveryMarkup':'118'},mode),mode=='DELIVERY'?1298:1180);
  expect(availableFulfillment({'dineOutEnabled':true},'DELIVERY'),'DINE_OUT');
 });
 testWidgets('product displays markup but keeps reusable cart base price',(tester)async{
  Map? result;
  await tester.pumpWidget(MaterialApp(home:Builder(builder:(context)=>Scaffold(body:TextButton(onPressed:()async{result=await Navigator.push<Map>(context,MaterialPageRoute(builder:(_)=>const ProductScreen(product:{'id':'p','name':'Meal','price':1180},currency:'RWF',deliveryMarkup:118)));},child:const Text('Open'))))));
  await tester.tap(find.text('Open'));await tester.pumpAndSettle();expect(find.text('1298 RWF'),findsOneWidget);
  await tester.tap(find.textContaining('Add 1 to cart'));await tester.pumpAndSettle();expect(result?['product']['price'],1180);
 });
 testWidgets('Dine Out requotes without delivery and identifies its free reward',(tester)async{
  tester.view.physicalSize=const Size(390,844);tester.view.devicePixelRatio=1;addTearDown(tester.view.resetPhysicalSize);addTearDown(tester.view.resetDevicePixelRatio);
  final modes=<String>[];
  final merchant={'id':'t','name':'Kitchen','currency':'RWF','deliveryMarkup':118,'branches':[{'id':'b','pickupEnabled':true,'deliveryEnabled':false,'dineOutEnabled':true}]};
  final api=ApiClient(client:MockClient((r)async{
   dynamic data=[];
   if(r.url.path.endsWith('/methods'))data={'methods':['CASH']};
   if(r.url.path.endsWith('/checkout-preview')){modes.add(jsonDecode(r.body)['fulfillmentType']);data={'subtotal':2950,'deliveryFee':0,'itemDiscount':590,'cartDiscount':0,'tax':360,'taxInclusive':true,'taxPercent':18,'taxLabel':'VAT','total':2360,'items':[{'quantity':2,'productName':'Meal','unitPrice':1180},{'quantity':1,'productName':'FREE · Drink','isFreeReward':true}]};}
   return http.Response(jsonEncode(data),200);
  }));
  await tester.pumpWidget(MaterialApp(home:CheckoutScreen(api:api,merchant:merchant,cart:const {'p':2},products:const {'p':{'id':'p','name':'Meal','price':1180}},initialFulfillment:'PICKUP')));await tester.pumpAndSettle();
  await tester.tap(find.text('Dine Out'));await tester.pumpAndSettle();expect(modes.last,'DINE_OUT');
  await tester.scrollUntilVisible(find.text('Subtotal'),200,scrollable:find.byType(Scrollable).first);await tester.pumpAndSettle();
  expect(find.text('1 × FREE · Drink'),findsOneWidget);expect(find.text('FREE'),findsOneWidget);expect(find.text('2360 RWF'),findsOneWidget);expect(tester.takeException(),isNull);api.close();
 });
}
