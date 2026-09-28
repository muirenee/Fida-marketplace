import 'format.dart';
const fulfillmentModes=['DELIVERY','PICKUP','DINE_OUT'];
String fulfillmentLabel(String mode)=>switch(mode){'PICKUP'=>'Pickup','DINE_OUT'=>'Dine Out',_=>'Delivery'};
String fulfillmentFlag(String mode)=>switch(mode){'PICKUP'=>'pickupEnabled','DINE_OUT'=>'dineOutEnabled',_=>'deliveryEnabled'};
String availableFulfillment(Map branch,String preferred)=>branch[fulfillmentFlag(preferred)]==true?preferred:fulfillmentModes.firstWhere((m)=>branch[fulfillmentFlag(m)]==true,orElse:()=>preferred);
double deliveryMarkup(Map? merchant,String mode)=>mode=='DELIVERY'?asDouble(merchant?['deliveryMarkup']):0;
double menuPrice(dynamic price,Map? merchant,String mode)=>asDouble(price)+deliveryMarkup(merchant,mode);
