import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:customer_mobile/core/api_client.dart';
import 'package:customer_mobile/screens/reorder_screen.dart';
import 'package:customer_mobile/screens/orders_screen.dart';
import 'package:customer_mobile/screens/cart_screen.dart';
class DraftApi extends ApiClient {
 final requests=<String>[];
 @override Future<dynamic> request(String method,String path,{Object? body}) async {
  requests.add(method);
  return {'merchant':{'id':'t','name':'Kitchen','currency':'RWF','branches':[{'id':'b','name':'Central','pickupEnabled':true,'deliveryEnabled':false}]},'branchId':'b','fulfillmentType':'DELIVERY','items':[
   {'id':'available','status':'AVAILABLE','quantity':2,'unitPrice':1600,'previousUnitPrice':1300,'priceChanged':true,'displayName':'Meal · Rice','selectedOptions':['Rice'],'product':{'id':'p','name':'Meal','price':1500,'options':[]}},
   {'id':'legacy','status':'RECONFIGURE','quantity':1,'previousName':'Old meal','message':'Choose current options','product':{'id':'p2','name':'Old meal','price':1000,'options':[]}},
   {'id':'gone','status':'UNAVAILABLE','quantity':1,'previousName':'Sold out','message':'No longer available','product':null},
  ]};
 }
}
class HistoryApi extends ApiClient {
 final responses=<String,Completer<List<Map<String,dynamic>>>>{};
 @override Future<List<Map<String,dynamic>>> orders({String? scope}) => (responses[scope!]=Completer<List<Map<String,dynamic>>>()).future;
}
void main(){
 testWidgets('reorder reviews only valid lines and never places an order automatically',(tester)async{
  final api=DraftApi();
  await tester.pumpWidget(MaterialApp(home:ReorderScreen(api:api,orderId:'o')));await tester.pumpAndSettle();
  expect(tester.widget<CheckboxListTile>(find.byKey(const ValueKey('reorder-available'))).value,true);
  expect(tester.widget<CheckboxListTile>(find.byKey(const ValueKey('reorder-legacy'))).onChanged,isNull);
  expect(find.text('Delivery'),findsNothing);
  await tester.tap(find.text('Review cart · 1 selected'));await tester.pumpAndSettle();
  final cart=tester.widget<CartScreen>(find.byType(CartScreen));
  expect(cart.cart,{'available':2});expect(cart.products['available']?['productId'],'p');expect(cart.products['available']?['selectedOptions'],['Rice']);expect(cart.products['available']?['price'],1600);expect(cart.fulfillment,'PICKUP');expect(api.requests,['GET']);expect(tester.takeException(),isNull);
  api.close();
 });
 testWidgets('late active response cannot replace the selected history queue',(tester)async{
  final api=HistoryApi();
  await tester.pumpWidget(MaterialApp(home:Scaffold(body:OrdersScreen(api:api))));await tester.pump();
  await tester.tap(find.text('History'));await tester.pump();
  api.responses['HISTORY']!.complete([{'id':'h','orderNumber':'PAST012','status':'COMPLETED','total':1000,'tenant':{'name':'Kitchen'},'items':[]}]);await tester.pumpAndSettle();
  api.responses['ACTIVE']!.complete([{'id':'a','orderNumber':'ACTIVE012','status':'PENDING'}]);await tester.pumpAndSettle();
  expect(find.text('PAST012'),findsOneWidget);expect(find.text('ACTIVE012'),findsNothing);expect(find.text('Order again'),findsOneWidget);expect(tester.takeException(),isNull);
  await tester.pumpWidget(const SizedBox());api.close();
 });
}
