import 'package:flutter/material.dart';
import 'api_client.dart';

class MerchantPromotionsPage extends StatefulWidget {
 const MerchantPromotionsPage({super.key,required this.api,required this.tenantId});
 final MerchantApiClient api;
 final String tenantId;
 @override State<MerchantPromotionsPage> createState()=>_MerchantPromotionsPageState();
}
class _MerchantPromotionsPageState extends State<MerchantPromotionsPage>{
 List<Map<String,dynamic>> products=[],offers=[];
 final form=GlobalKey<FormState>();
 final code=TextEditingController(),buy=TextEditingController(text:'2'),cap=TextEditingController(),minimum=TextEditingController(text:'0'),uses=TextEditingController(text:'100');
 String? trigger,reward,error;
 DateTime expires=DateTime.now().add(const Duration(days:7));
 bool busy=true,stackable=true;
 Future<dynamic> call(String path,{String method='GET',Object? body})=>widget.api.request(method,'/v1/merchant/$path',tenantId:widget.tenantId,body:body);
 @override void initState(){super.initState();load();}
 @override void dispose(){for(final c in [code,buy,cap,minimum,uses]){c.dispose();}super.dispose();}
 Future<void> load()async{
  try{final results=await Future.wait([call('products'),call('promotions')]);if(!mounted)return;setState((){products=(results[0] as List).map((p)=>Map<String,dynamic>.from(p)).where((p)=>p['isActive']==true&&p['isAvailable']==true&&p['deletedAt']==null&&(p['category']==null||p['category']['isActive']==true)).toList();offers=(results[1] as List).map((p)=>Map<String,dynamic>.from(p)).toList();if(!products.any((p)=>p['id']==trigger))trigger=null;if(!products.any((p)=>p['id']==reward))reward=null;});}
  catch(e){if(mounted)setState(()=>error='$e');}finally{if(mounted)setState(()=>busy=false);}
 }
 Future<void> save()async{
  if(!form.currentState!.validate())return;
  setState((){busy=true;error=null;});
  try{await call('promotions',method:'POST',body:{'code':code.text.trim(),'discountType':'BOGO','productId':trigger,'rewardProductId':reward,'buyQuantity':num.parse(buy.text).toInt(),'getQuantity':1,'maxDiscount':double.parse(cap.text),'minimumOrder':double.parse(minimum.text),'maxUses':num.parse(uses.text).toInt(),'expiresAt':expires.toUtc().toIso8601String(),'stackable':stackable});code.clear();await load();if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Promotion created.')));}
  catch(e){if(mounted)setState(()=>error='$e');}finally{if(mounted)setState(()=>busy=false);}
 }
 Widget number(String title,TextEditingController c,double max,{bool integer=false,double min=0})=>TextFormField(controller:c,enabled:!busy,keyboardType:TextInputType.numberWithOptions(decimal:!integer),decoration:InputDecoration(labelText:title),validator:(v){final n=double.tryParse(v??'');return n==null||!n.isFinite||n<min||n>max||(integer&&n!=n.roundToDouble())?'Enter ${integer?'a whole number':'an amount'} from $min to $max':null;});
 String productName(dynamic id)=>products.where((p)=>p['id']==id).firstOrNull?['name']?.toString()??'Unavailable product';
 @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Product promotions')),body:RefreshIndicator(onRefresh:load,child:Form(key:form,child:ListView(padding:const EdgeInsets.all(20),children:[
  if(busy)const LinearProgressIndicator(),if(error!=null)Text(error!,style:TextStyle(color:Theme.of(context).colorScheme.error)),
  const Text('Buy X, get a product free',style:TextStyle(fontSize:25,fontWeight:FontWeight.w800)),
  const Text('Select products from this store. A free reward never earns another reward. Prices and caps include tax.'),
  TextFormField(controller:code,enabled:!busy,maxLength:32,decoration:const InputDecoration(labelText:'Promotion code'),validator:(v)=>RegExp(r'^[A-Za-z0-9_-]{3,32}$').hasMatch(v?.trim()??'')?null:'Use 3–32 letters, numbers, underscores or hyphens'),
  DropdownButtonFormField<String>(key:ValueKey('trigger-$trigger'),initialValue:trigger,isExpanded:true,decoration:const InputDecoration(labelText:'Paid product'),items:[for(final p in products)DropdownMenuItem(value:p['id'].toString(),child:Text(p['name'].toString()))],onChanged:busy?null:(v)=>setState(()=>trigger=v),validator:(v)=>v==null?'Select a paid product':null),
  number('Paid units for one reward',buy,50,integer:true,min:1),
  DropdownButtonFormField<String>(key:ValueKey('reward-$reward'),initialValue:reward,isExpanded:true,decoration:const InputDecoration(labelText:'Free reward product'),items:[for(final p in products)DropdownMenuItem(value:p['id'].toString(),child:Text(p['name'].toString()))],onChanged:busy?null:(v)=>setState(()=>reward=v),validator:(v)=>v==null?'Select a reward product':null),
  const Text('Rewards needing choices must be configured by the customer. Other rewards are added automatically at checkout.'),
  number('Maximum discount per order',cap,100000000,min:0.01),number('Minimum order',minimum,100000000),number('Maximum redemptions',uses,100000,integer:true,min:1),
  CheckboxListTile(contentPadding:EdgeInsets.zero,title:const Text('Allow cart promo codes with this offer'),value:stackable,onChanged:busy?null:(v)=>setState(()=>stackable=v??false)),
  ListTile(contentPadding:EdgeInsets.zero,title:const Text('Expires'),subtitle:Text('${expires.toLocal()}'),trailing:const Icon(Icons.calendar_today),onTap:busy?null:()async{final now=DateTime.now();final d=await showDatePicker(context:context,initialDate:expires.isBefore(now)?now:expires,firstDate:DateTime(now.year,now.month,now.day),lastDate:now.add(const Duration(days:730)));if(d==null||!context.mounted)return;final t=await showTimePicker(context:context,initialTime:TimeOfDay.fromDateTime(expires));if(t!=null&&mounted)setState(()=>expires=DateTime(d.year,d.month,d.day,t.hour,t.minute));}),
  FilledButton(onPressed:busy?null:save,child:const Text('Create promotion')),const Divider(height:40),
  for(final p in offers)Card(child:SwitchListTile(title:Text(p['discountType']=='BOGO'?'${p['code']} · Buy ${p['buyQuantity']}, get 1 free':'${p['code']} · ${p['discountType']}'),subtitle:Text(p['discountType']=='BOGO'?'${productName(p['productId'])} → ${productName(p['rewardProductId']??p['productId'])}\n${p['usedCount']}/${p['maxUses']} redemptions':'${p['usedCount']}/${p['maxUses']} redemptions'),value:p['isActive']==true,onChanged:busy?null:(v)async{setState((){busy=true;error=null;});try{await call('promotions/${p['id']}',method:'PATCH',body:{'isActive':v});await load();}catch(e){if(mounted)setState(()=>error='$e');}finally{if(mounted)setState(()=>busy=false);}})),
 ]))));
}
