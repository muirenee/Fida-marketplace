import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:fida_mobile_common/fida_mobile_common.dart';
import 'package:customer_mobile/core/api_client.dart';
import 'package:customer_mobile/screens/product_screen.dart';
import 'package:customer_mobile/screens/checkout_screen.dart';
void main(){
 TestWidgetsFlutterBinding.ensureInitialized();FlutterSecureStorage.setMockInitialValues({});
 testWidgets('premium quantities stay independent and product badge names the trigger',(tester)async{
  tester.view.physicalSize=const Size(390,844);tester.view.devicePixelRatio=1;addTearDown(tester.view.resetPhysicalSize);addTearDown(tester.view.resetDevicePixelRatio);
  Map? result;
  final product={'id':'p','name':'Meal','price':1180,'options':[{'name':'Cheese','price':118},{'name':'Sauce','price':59}],'promotions':[{'discountType':'BOGO','buyQuantity':2}]};
  await tester.pumpWidget(MaterialApp(home:Builder(builder:(context)=>Scaffold(body:TextButton(onPressed:()async{result=await Navigator.push<Map>(context,MaterialPageRoute(builder:(_)=>ProductScreen(product:product,currency:'RWF',initialQuantity:2)));},child:const Text('Customize'))))));
  await tester.tap(find.text('Customize'));await tester.pumpAndSettle();
  expect(find.text('Buy 2, get 1 free'),findsOneWidget);expect(find.byType(CheckboxListTile),findsNothing);
  for(final selection in [('Cheese',2),('Sauce',3)]){
   final control=find.byKey(ValueKey('modifier-${selection.$1}'));await tester.ensureVisible(control);await tester.pumpAndSettle();
   for(var i=0;i<selection.$2;i++){await tester.tap(find.descendant(of:control,matching:find.byIcon(Icons.add)));await tester.pumpAndSettle();}
   expect(tester.widget<QuantityControl>(control).value,selection.$2);expect(find.descendant(of:control,matching:find.byIcon(Icons.remove)),findsOneWidget);
  }
  await tester.tap(find.byType(FilledButton));await tester.pumpAndSettle();
  expect(result?['quantity'],2);expect(result?['product']['price'],1593);expect(result?['product']['selectedOptions'],[{'name':'Cheese','quantity':2},{'name':'Sauce','quantity':3}]);expect(result?['product']['modifierLines'][0]['totalPrice'],236);expect(tester.takeException(),isNull);
 });
 testWidgets('checkout shows free reward and included tax without increasing cash due',(tester)async{
  final merchant={'id':'t','name':'Kitchen','currency':'RWF','branches':[{'id':'b','pickupEnabled':true,'deliveryEnabled':true}]};
  final api=ApiClient(client:MockClient((r)async=>http.Response(jsonEncode(r.url.path.endsWith('/methods')?{'methods':['CASH']}:r.url.path.endsWith('/checkout-preview')?{'subtotal':3540,'deliveryFee':0,'itemDiscount':1180,'cartDiscount':0,'tax':360,'taxInclusive':true,'taxPercent':18,'taxLabel':'VAT','total':2360,'items':[{'quantity':1,'productName':'Meal','isFreeReward':true}]}:[]),200)));
  await tester.pumpWidget(MaterialApp(theme:fidaTheme(),home:CheckoutScreen(api:api,merchant:merchant,cart:const {'p':2},products:const {'p':{'id':'p','name':'Meal','price':1180}},initialFulfillment:'PICKUP')));await tester.pumpAndSettle();
  await tester.scrollUntilVisible(find.text('Subtotal'),250,scrollable:find.byType(Scrollable).first);await tester.pumpAndSettle();
  expect(find.text('FREE'),findsOneWidget);expect(find.textContaining('Includes 18% VAT'),findsOneWidget);expect(find.text('VAT (18%)'),findsNothing);expect(find.text('2360 RWF'),findsOneWidget);expect(tester.takeException(),isNull);api.close();
 });
}
