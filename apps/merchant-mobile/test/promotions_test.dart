import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:merchant_mobile/api_client.dart';
import 'package:merchant_mobile/promotions_page.dart';
class PromoApi extends MerchantApiClient{
 Map? created;
 @override Future<dynamic> request(String method,String path,{Object? body,String? tenantId})async{
  if(path.endsWith('/products'))return [for(final item in [('meal','Meal'),('drink','Drink')]){'id':item.$1,'name':item.$2,'isActive':true,'isAvailable':true}];
  if(method=='POST'){created=body as Map;return {'id':'offer'};}
  return [];
 }
}
void main(){
 testWidgets('merchant chooses trigger and reward catalog products and submits a scoped offer',(tester)async{
  tester.view.physicalSize=const Size(800,1400);tester.view.devicePixelRatio=1;addTearDown(tester.view.resetPhysicalSize);addTearDown(tester.view.resetDevicePixelRatio);
  final api=PromoApi();await tester.pumpWidget(MaterialApp(home:MerchantPromotionsPage(api:api,tenantId:'tenant')));await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField,'Promotion code'),'PAIR015');
  await tester.tap(find.byType(DropdownButtonFormField<String>).first);await tester.pumpAndSettle();await tester.tap(find.text('Meal').last);await tester.pumpAndSettle();
  await tester.tap(find.byType(DropdownButtonFormField<String>).last);await tester.pumpAndSettle();await tester.tap(find.text('Drink').last);await tester.pumpAndSettle();
  await tester.enterText(find.widgetWithText(TextFormField,'Maximum discount per order'),'10000');
  await tester.ensureVisible(find.text('Create promotion'));await tester.tap(find.text('Create promotion'));await tester.pumpAndSettle();
  expect(api.created?['productId'],'meal');expect(api.created?['rewardProductId'],'drink');expect(api.created?['buyQuantity'],2);expect(api.created?['getQuantity'],1);expect(tester.takeException(),isNull);
 });
}
