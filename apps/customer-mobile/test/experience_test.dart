import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:fida_mobile_common/fida_mobile_common.dart';
import 'package:customer_mobile/core/api_client.dart';
import 'package:customer_mobile/screens/marketplace_screen.dart';
import 'package:customer_mobile/screens/product_screen.dart';
import 'package:customer_mobile/screens/cart_screen.dart';
import 'package:customer_mobile/screens/merchant_screen.dart';
import 'package:customer_mobile/screens/checkout_screen.dart';

final product = <String, dynamic>{
  'id': 'p',
  'name': 'Rice bowl',
  'description': 'Fresh vegetables with your choice of rice.',
  'price': 2500,
  'options': [
    {
      'name': 'White rice',
      'price': 0,
      'group': 'Rice',
      'minSelect': 1,
      'maxSelect': 1,
    },
    {
      'name': 'Brown rice',
      'price': 300,
      'group': 'Rice',
      'minSelect': 1,
      'maxSelect': 1,
    },
  ],
};
final merchant = <String, dynamic>{
  'id': 't',
  'slug': 'kitchen',
  'name': 'Kigali Kitchen',
  'currency': 'RWF',
  'merchantType': 'RESTAURANT',
  'minimumOrder': 0,
  'featured': true,
  'completedOrders': 12,
  'favoriteCount': 8,
  'dishes': [product],
  'rating': 4.8,
  'reviewCount': 12,
  'branches': [
    {
      'id': 'b',
      'name': 'Gikondo',
      'city': 'Kigali',
      'addressLine': 'KK 31 Avenue',
      'isOpen': true,
      'pickupEnabled': true,
      'deliveryEnabled': true,
      'deliveryZones': [
        {'fee': 500},
      ],
    },
  ],
  'promotions': [
    {
      'percent': 10,
      'code': 'WELCOME',
      'minimumOrder': 1000,
      'maxDiscount': 1500,
    },
  ],
  'categories': [
    {
      'id': 'c',
      'name': 'Lunch',
      'products': [product],
    },
  ],
};
ApiClient api() => ApiClient(
  client: MockClient(
    (r) async => http.Response(
      jsonEncode(
        r.url.path.endsWith('/addresses') ? []
            : r.url.path.endsWith('/methods') ? {'methods':['CASH']}
            : r.url.path.endsWith('/checkout-preview') ? {'subtotal':2500,'deliveryFee':0,'itemDiscount':100,'cartDiscount':240,'tax':388.8,'taxLabel':'VAT','taxPercent':18,'total':2548.8}
            : r.url.path.endsWith('/merchants')
            ? [merchant]
            : (r.url.path.endsWith('/favorites') || r.url.path.endsWith('/recent-stores'))
            ? []
            : merchant,
      ),
      200,
    ),
  ),
);
Future<void> capture(WidgetTester tester, GlobalKey key, String name) async {
  await tester.runAsync(() async {
    final boundary =
        key.currentContext!.findRenderObject() as RenderRepaintBoundary;
    final img = await boundary.toImage(pixelRatio: 2);
    final bytes = await img.toByteData(format: ui.ImageByteFormat.png);
    final dir = Directory('build/ui-previews')..createSync(recursive: true);
    File('${dir.path}/$name.png').writeAsBytesSync(bytes!.buffer.asUint8List());
    img.dispose();
  });
}

Future<void> mount(
  WidgetTester tester,
  Widget child,
  GlobalKey key, {
  double scale = 1,
}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    MaterialApp(
      theme: fidaTheme(),
      home: MediaQuery(
        data: MediaQueryData(
          size: const Size(390, 844),
          padding: const EdgeInsets.only(top:32,bottom:24),
          textScaler: TextScaler.linear(scale),
        ),
        child: RepaintBoundary(key: key, child: child),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    // Use readable fonts in captured previews instead of the test-only Ahem font.
    for (final font in [('Roboto', 'regular.ttf'), ('MaterialIcons', 'icons.otf')]) {
      final file = File('build/test-fonts/${font.$2}');
      if (await file.exists()) {
        final bytes = await file.readAsBytes();
        final loader = FontLoader(font.$1)..addFont(Future.value(ByteData.sublistView(bytes)));
        await loader.load();
      }
    }
  });
  testWidgets(
    'home displays real store and filters pickup without layout errors',
    (tester) async {
      final client = api(), key = GlobalKey();
      await mount(tester, Scaffold(body: MarketplaceScreen(api: client)), key);
      expect(find.text('Kigali Kitchen'), findsWidgets);
      expect(tester.takeException(), isNull);
      await capture(tester, key, 'customer-home');
      await tester.tap(find.text('Pickup'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Pickup ·'), findsWidgets);
      expect(tester.takeException(), isNull);
      for (final heading in ['Featured on Fida','Recently Viewed','Stores near you','Popular in your area','Neighborhood Favorites','Best Overall','Most popular local restaurants','Discover a new favorite dish','All Stores']) {
        await tester.scrollUntilVisible(find.text(heading), 250, scrollable: find.byType(Scrollable).first);
        expect(find.text(heading), findsOneWidget);
        expect(tester.takeException(), isNull, reason: heading);
      }
      client.close();
    },
  );
  testWidgets(
    'required choice blocks adding, single-choice group replaces prior selection',
    (tester) async {
      final key = GlobalKey();
      await mount(
        tester,
        ProductScreen(product: product, currency: 'RWF'),
        key,
      );
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull,
      );
      await tester.tap(find.text('White rice'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Brown rice'));
      await tester.pumpAndSettle();
      final checks = tester
          .widgetList<CheckboxListTile>(find.byType(CheckboxListTile))
          .toList();
      expect(checks[0].value, false);
      expect(checks[1].value, true);
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNotNull,
      );
      expect(tester.takeException(), isNull);
      await capture(tester, key, 'customer-product');
    },
  );
  testWidgets(
    'cart keeps separate product configurations and removes only one line',
    (tester) async {
      final client = api(), key = GlobalKey();
      final cart = {'white': 1, 'brown': 2};
      await mount(
        tester,
        CartScreen(
          api: client,
          merchant: merchant,
          cart: cart,
          products: {
            'white': {
              ...product,
              'productId': 'p',
              'price': 2500,
              'name': 'Rice bowl (White rice)',
              'selectedOptions': ['White rice'],
            },
            'brown': {
              ...product,
              'productId': 'p',
              'price': 2800,
              'name': 'Rice bowl (Brown rice)',
              'selectedOptions': ['Brown rice'],
            },
          },
          fulfillment: 'PICKUP',
        ),
        key,
      );
      expect(find.textContaining('White rice'), findsOneWidget);
      expect(find.textContaining('Brown rice'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await capture(tester, key, 'customer-cart');
      await tester.tap(find.byTooltip('Remove item'));
      await tester.pumpAndSettle();
      expect(cart.containsKey('white'), false);
      expect(cart['brown'], 2);
      client.close();
    },
  );
  testWidgets('store page renders menu and fulfillment controls', (
    tester,
  ) async {
    final client = api(), key = GlobalKey();
    await mount(tester, MerchantScreen(api: client, slug: 'kitchen'), key);
    expect(find.text('Kigali Kitchen'), findsWidgets);
    expect(find.text('Delivery'), findsOneWidget);
    expect(tester.takeException(), isNull);
    expect(tester.getTopLeft(find.byType(CustomScrollView)).dy, greaterThanOrEqualTo(32));
    expect(find.byKey(const ValueKey('menu-panel-top')), findsOneWidget);
    await capture(tester, key, 'customer-store');
    client.close();
  });
  testWidgets('checkout shows itemized server totals without clipping at enlarged text size', (tester) async {
    final client=api(), key=GlobalKey();
    await mount(tester, CheckoutScreen(api:client,merchant:merchant,cart:{'p':1},products:{'p':product},initialFulfillment:'PICKUP',orderNote:'No salt'), key,scale:1.3);
    await tester.scrollUntilVisible(find.text('Total'),300,scrollable:find.byType(Scrollable).first);
    await tester.pumpAndSettle();
    expect(find.text('VAT (18%)'),findsOneWidget);
    expect(find.text('Item discounts'),findsOneWidget);
    expect(find.text('Promo discount'),findsOneWidget);
    expect(tester.takeException(),isNull);
    await capture(tester,key,'customer-checkout');
    client.close();
  });

  test('bodyless mutations send structured JSON and reads omit content-type', () async {
    final client = ApiClient(client: MockClient((r) async {
      if (r.method == 'GET') {
        expect(r.headers.containsKey('content-type'), false);
        return http.Response('[]', 200);
      }
      expect(r.headers['content-type'], contains('application/json'));
      expect(jsonDecode(r.body), <String, dynamic>{});
      return http.Response('', 204);
    }));
    await client.request('PUT', '/v1/customer/favorites/t');
    await client.request('DELETE', '/v1/customer/favorites/t');
    await client.request('DELETE', '/v1/customer/addresses/a');
    await client.request('GET', '/v1/customer/addresses');
    client.close();
  });

}
