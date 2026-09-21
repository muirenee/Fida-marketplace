import 'package:flutter_test/flutter_test.dart';
import 'package:fida_mobile_common/fida_mobile_common.dart';

void main() {
  test('configuration rebinds API, merchant links and owned media without changing external images', () async {
    final endpoints=FidaEndpoints('https://old.example.test');
    addTearDown(endpoints.dispose);
    var notices=0;endpoints.addListener(()=>notices++);
    final data={'schemaVersion':1,'apiBaseUrl':'https://new.example.test','publicBaseUrl':'https://portal.example.test','legacyOrigins':['https://old.example.test']};
    await endpoints.refresh(fetch:(uri)async{expect(uri.toString(),'https://old.example.test/v1/config');return data;});
    expect(endpoints.apiUri('/v1/customer/orders').toString(),'https://new.example.test/v1/customer/orders');
    expect(endpoints.merchantUri.toString(),'https://portal.example.test/merchant');
    expect(FidaEndpoints.mediaUri('https://old.example.test','https://old.example.test/v1/media/t/a.webp'),'https://new.example.test/v1/media/t/a.webp');
    expect(FidaEndpoints.mediaUri('https://old.example.test','https://images.example.test/photo.jpg'),'https://images.example.test/photo.jpg');
    expect(notices,1);
    await endpoints.refresh(fetch:(_)async=>throw StateError('Should use TTL'));
    expect(notices,1);
    expect(()=>endpoints.apply({...data,'apiBaseUrl':'http://attacker.test'}),throwsFormatException);
    expect(()=>endpoints.apply({...data,'apiBaseUrl':'https://user:secret@attacker.test'}),throwsFormatException);
    expect(()=>endpoints.apiUri('//attacker.test'),throwsArgumentError);
  });
  test('uses last learned endpoint when bootstrap is offline',()async{
    final endpoints=FidaEndpoints('https://old.example.test');addTearDown(endpoints.dispose);
    await endpoints.refresh(readCache:()async=>'{"schemaVersion":1,"apiBaseUrl":"https://new.example.test","publicBaseUrl":"https://new.example.test","legacyOrigins":[]}',fetch:(uri)async{
      expect(uri.host,'new.example.test');return {'schemaVersion':1,'apiBaseUrl':'https://new.example.test','publicBaseUrl':'https://new.example.test','legacyOrigins':[]};
    });
    expect(endpoints.value.apiBaseUrl,'https://new.example.test');
  });
}
