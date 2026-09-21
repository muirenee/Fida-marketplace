import 'package:flutter/material.dart';
import 'package:fida_mobile_common/fida_mobile_common.dart';
import 'api_client.dart';

class MerchantBusinessPage extends StatefulWidget {
  const MerchantBusinessPage({super.key, required this.api, required this.tenantId});
  final MerchantApiClient api;
  final String tenantId;
  @override
  State<MerchantBusinessPage> createState() => _MerchantBusinessPageState();
}
class _MerchantBusinessPageState extends State<MerchantBusinessPage> {
  final rate = TextEditingController(), label = TextEditingController();
  final form = GlobalKey<FormState>();
  bool busy = true;
  String? error;
  @override
  void initState(){super.initState();load();}
  @override
  void dispose(){rate.dispose();label.dispose();super.dispose();}
  Future<void> load() async {
    try {final data = await widget.api.request('GET','/v1/merchant/context',tenantId:widget.tenantId);
      if(!mounted)return;rate.text='${data['tenant']['taxPercent']}';label.text='${data['tenant']['taxLabel']}';
    } catch(e){if(mounted)setState(()=>error='$e');}finally{if(mounted)setState(()=>busy=false);}
  }
  Future<void> save() async {
    if(!form.currentState!.validate())return;
    setState((){busy=true;error=null;});
    try{await widget.api.request('PATCH','/v1/merchant/settings',tenantId:widget.tenantId,body:{'taxPercent':double.parse(rate.text),'taxLabel':label.text.trim()});
      if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Tax settings saved.')));
    }catch(e){if(mounted)setState(()=>error='$e');}finally{if(mounted)setState(()=>busy=false);}
  }
  @override
  Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Business settings')),body:SafeArea(child:Form(key:form,child:ListView(padding:const EdgeInsets.all(24),children:[
    const Text('Sales tax',style:TextStyle(fontSize:26,fontWeight:FontWeight.w800)),
    const Text('Calculated on merchandise after item and coupon discounts. Delivery fees are excluded.'),
    const SizedBox(height:20),
    TextFormField(controller:label,decoration:const InputDecoration(labelText:'Tax name'),maxLength:40,validator:(v)=>(v?.trim().isEmpty??true)?'Enter a tax name':null),
    TextFormField(controller:rate,decoration:const InputDecoration(labelText:'Tax rate (%)'),keyboardType:const TextInputType.numberWithOptions(decimal:true),validator:(v){final n=double.tryParse(v??'');return n==null||!n.isFinite||n<0||n>100?'Enter a rate from 0 to 100':null;}),
    if(error!=null)Text(error!,style:const TextStyle(color:Colors.red)),
    const SizedBox(height:20),FilledButton(onPressed:busy?null:save,child:Text(busy?'Saving…':'Save tax settings')),
    const Divider(height:40),
    ListTile(title:const Text('Staff, promotions and driver payments'),subtitle:const Text('Open your secure business portal to manage staff roles, targeted offers and payment records.'),trailing:const Icon(Icons.open_in_new),onTap:()async{await widget.api.refreshConfiguration(force:true);if(context.mounted)await openFidaLink(context,MerchantApiClient.endpoints.merchantUri);}),
  ]))));
}
