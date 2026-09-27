import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geocoding/geocoding.dart' as geo;
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';

typedef ReverseAddress = Future<({String address, String city})> Function(double, double);
Future<({String address, String city})> reverseDeliveryPoint(double lat, double lon) async {
  final places=await geo.Geocoding().placemarkFromCoordinates(lat,lon).timeout(const Duration(seconds:8));
  if(places.isEmpty) throw StateError('Address unavailable');
  final p=places.first;
  final parts=[p.street,p.subLocality,p.locality].whereType<String>().map((s)=>s.trim()).where((s)=>s.isNotEmpty).toSet();
  if(parts.isEmpty) throw StateError('Address unavailable');
  return (address:parts.join(', '),city:p.locality??p.subAdministrativeArea??'');
}

class DeliveryPinScreen extends StatefulWidget {
  const DeliveryPinScreen({super.key,this.initial=const {},this.reverse=reverseDeliveryPoint,this.showTiles=true});
  final Map<String,dynamic> initial;
  final ReverseAddress reverse;
  final bool showTiles;
  @override
  State<DeliveryPinScreen> createState()=>_DeliveryPinScreenState();
}
class _DeliveryPinScreenState extends State<DeliveryPinScreen> {
  final map=MapController();
  final mapKey=GlobalKey();
  final address=TextEditingController(),city=TextEditingController(),label=TextEditingController(),instructions=TextEditingController();
  LatLng point=const LatLng(-1.9441,30.0619);
  bool selected=false,looking=false,locating=false,isDefault=false;
  String? error;
  Timer? debounce;
  int generation=0;
  @override
  void initState(){
    super.initState();final v=widget.initial;
    address.text='${v['addressLine']??''}';city.text='${v['city']??''}';label.text='${v['label']??'Home'}';instructions.text='${v['instructions']??''}';isDefault=v['isDefault']==true;
    final lat=double.tryParse('${v['latitude']}'),lon=double.tryParse('${v['longitude']}');
    if(lat!=null&&lon!=null&&lat.isFinite&&lon.isFinite&&lat.abs()<=90&&lon.abs()<=180){point=LatLng(lat,lon);selected=true;}
  }
  @override
  void dispose(){debounce?.cancel();map.dispose();address.dispose();city.dispose();label.dispose();instructions.dispose();super.dispose();}
  void select(LatLng value,{bool move=false}){
    final version=++generation;debounce?.cancel();
    setState((){point=LatLng(value.latitude.clamp(-90,90),((value.longitude+180)%360)-180);selected=true;looking=true;error=null;address.clear();city.clear();});
    if(move)map.move(point,16);
    final selectedPoint=point;
    debounce=Timer(const Duration(milliseconds:900),()=>resolve(selectedPoint,version));
  }
  Future<void> resolve(LatLng value,int version) async {
    try{
      final result=await widget.reverse(value.latitude,value.longitude);
      if(!mounted||version!=generation)return;
      setState((){if(address.text.trim().isEmpty)address.text=result.address;if(city.text.trim().isEmpty)city.text=result.city;});
    }catch(_){if(mounted&&version==generation)setState(()=>error='Address lookup unavailable. Enter the street address below; your pin is saved.');}
    finally{if(mounted&&version==generation)setState(()=>looking=false);}
  }
  Future<void> locate() async {
    setState(()=>locating=true);
    try{
      var permission=await Geolocator.checkPermission();
      if(permission==LocationPermission.denied)permission=await Geolocator.requestPermission();
      if(permission==LocationPermission.denied||permission==LocationPermission.deniedForever)throw StateError('Allow location access or choose a point on the map.');
      final pos=await Geolocator.getCurrentPosition().timeout(const Duration(seconds:15));
      if(mounted)select(LatLng(pos.latitude,pos.longitude),move:true);
    }catch(_){if(mounted)setState(()=>error='Current location unavailable. Tap or drag the map to choose your delivery point.');}
    finally{if(mounted)setState(()=>locating=false);}
  }
  @override
  Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:const Text('Delivery location')),
    body:ListView(padding:const EdgeInsets.all(16),children:[
      const Text('Tap the map, move it, or drag the pin to your entrance.'),const SizedBox(height:12),
      SizedBox(height:280,child:FlutterMap(key:mapKey,mapController:map,options:MapOptions(initialCenter:point,initialZoom:16,onTap:(_,p)=>select(p),onPositionChanged:(camera,gesture){if(gesture)select(camera.center);}),children:[
        if(widget.showTiles) TileLayer(urlTemplate:const String.fromEnvironment('FIDA_MAP_TILE_URL',defaultValue:'https://tile.openstreetmap.org/{z}/{x}/{y}.png'),userAgentPackageName:'com.fidalix.marketplace.customer_mobile'),
        MarkerLayer(markers:[Marker(point:point,width:52,height:60,child:GestureDetector(key:const ValueKey('delivery-pin'),onPanUpdate:(event){final box=mapKey.currentContext?.findRenderObject() as RenderBox?;if(box!=null)select(map.camera.screenOffsetToLatLng(box.globalToLocal(event.globalPosition)));},child:const Icon(Icons.location_pin,size:52,color:Color(0xFF07855A))))]),
        RichAttributionWidget(attributions:[TextSourceAttribution('OpenStreetMap contributors',onTap:()=>launchUrl(Uri.parse('https://www.openstreetmap.org/copyright')))]),
      ])),
      TextButton.icon(onPressed:locating?null:locate,icon:const Icon(Icons.my_location),label:Text(locating?'Locating…':'Use my current location')),
      if(selected)Text('${point.latitude.toStringAsFixed(6)}, ${point.longitude.toStringAsFixed(6)}'),
      if(looking)const LinearProgressIndicator(),
      if(error!=null)Padding(padding:const EdgeInsets.symmetric(vertical:8),child:Text(error!,style:const TextStyle(color:Colors.deepOrange))),
      TextField(key:const ValueKey('pin-address'),controller:address,maxLength:500,decoration:const InputDecoration(labelText:'Street address')),
      const SizedBox(height:12),TextField(key:const ValueKey('pin-city'),controller:city,maxLength:500,decoration:const InputDecoration(labelText:'City')),
      const SizedBox(height:12),TextField(controller:label,maxLength:500,decoration:const InputDecoration(labelText:'Label (Home, Work)')),
      const SizedBox(height:12),TextField(controller:instructions,maxLength:500,decoration:const InputDecoration(labelText:'Delivery instructions')),
      SwitchListTile(contentPadding:EdgeInsets.zero,title:const Text('Use as default address'),value:isDefault,onChanged:(v)=>setState(()=>isDefault=v)),
    ]),
    bottomNavigationBar:SafeArea(minimum:const EdgeInsets.all(16),child:FilledButton(onPressed:(){
      if(!selected||address.text.trim().isEmpty){setState(()=>error='Choose a pin and enter the street address.');return;}
      Navigator.pop(context,<String,dynamic>{'latitude':point.latitude,'longitude':point.longitude,'addressLine':address.text.trim(),'city':city.text.trim(),'label':label.text.trim(),'instructions':instructions.text.trim(),'isDefault':isDefault});
    },child:const Text('Use this delivery location'))),
  );
}
