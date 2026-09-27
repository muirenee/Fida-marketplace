import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../ui/format.dart';
import 'product_screen.dart';
import 'cart_screen.dart';

class ReorderScreen extends StatefulWidget {
  const ReorderScreen({super.key,required this.api,required this.orderId});
  final ApiClient api;
  final String orderId;
  @override
  State<ReorderScreen> createState()=>_ReorderScreenState();
}
class _ReorderScreenState extends State<ReorderScreen> {
  Map<String,dynamic>? data;
  List<Map<String,dynamic>> items=[];
  final selected=<String>{};
  String? error,branchId;
  String fulfillment='DELIVERY';
  bool loading=true;
  String get currency=>data?['merchant']?['currency']?.toString()??'RWF';
  List get branches=>data?['merchant']?['branches'] as List? ?? [];
  Map get branch=>branches.where((b)=>b['id']==branchId).firstOrNull as Map? ?? {};
  @override
  void initState(){super.initState();load();}
  Future<void> load() async {
    setState((){loading=true;error=null;});
    try{
      final result=await widget.api.request('GET','/v1/customer/orders/${widget.orderId}/reorder') as Map;
      if(!mounted)return;
      setState((){
        data=result.cast<String,dynamic>();items=(result['items'] as List).map((i)=>Map<String,dynamic>.from(i)).toList();
        selected.clear();selected.addAll(items.where((i)=>i['status']=='AVAILABLE').map((i)=>i['id'].toString()));
        branchId=result['branchId'];fulfillment=result['fulfillmentType'];normalizeMode();
      });
    }catch(e){if(mounted)setState(()=>error='$e');}
    finally{if(mounted)setState(()=>loading=false);}
  }
  void normalizeMode(){if(branch[fulfillment=='PICKUP'?'pickupEnabled':'deliveryEnabled']!=true)fulfillment=branch['pickupEnabled']==true?'PICKUP':'DELIVERY';}
  Future<void> configure(Map<String,dynamic> item) async {
    final product=Map<String,dynamic>.from(item['product']);
    final result=await Navigator.push<Map<String,dynamic>>(context,MaterialPageRoute(builder:(_)=>ProductScreen(product:product,currency:currency,initialQuantity:(item['quantity'] as num).toInt(),initialSelectedOptions:(item['selectedOptions'] as List? ?? []))));
    if(result==null||!mounted)return;
    final configured=result['product'] as Map;
    setState((){item.addAll({'status':'AVAILABLE','message':null,'quantity':result['quantity'],'unitPrice':configured['price'],'priceChanged':asDouble(configured['price'])!=asDouble(item['previousUnitPrice']),'displayName':configured['name'],'selectedOptions':configured['selectedOptions'],'modifierLines':configured['modifierLines'],'baseUnitPrice':configured['baseUnitPrice']});selected.add(item['id'].toString());});
  }
  Future<void> openCart() async {
    final cart=<String,int>{},products=<String,Map<String,dynamic>>{};
    for(final item in items.where((i)=>selected.contains(i['id']))){
      final key=item['id'].toString(),product=Map<String,dynamic>.from(item['product']);
      cart[key]=(item['quantity'] as num).toInt();
      products[key]={...product,'productId':product['id'],'name':item['displayName'],'price':item['unitPrice'],'selectedOptions':item['selectedOptions']??[],'modifierLines':item['modifierLines']??[],'baseUnitPrice':item['baseUnitPrice']};
    }
    if(cart.isEmpty)return;
    await Navigator.push(context,MaterialPageRoute(builder:(_)=>CartScreen(api:widget.api,merchant:{...Map<String,dynamic>.from(data!['merchant']),'branches':[branch]},cart:cart,products:products,fulfillment:fulfillment)));
  }
  @override
  Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:const Text('Order again')),
    body:loading?const Center(child:CircularProgressIndicator()):data==null?Center(child:Column(mainAxisSize:MainAxisSize.min,children:[Padding(padding:const EdgeInsets.all(20),child:Text(error??'Unable to load this order.')),OutlinedButton(onPressed:load,child:const Text('Retry'))])):ListView(padding:const EdgeInsets.all(20),children:[
      Text('${data!['merchant']['name']}',style:Theme.of(context).textTheme.headlineSmall),
      const SizedBox(height:8),const Text('Review current prices and choices. Promotions, tax and delivery are recalculated at checkout.'),
      const SizedBox(height:16),
      DropdownButtonFormField<String>(initialValue:branchId,isExpanded:true,decoration:const InputDecoration(labelText:'Branch'),items:branches.map((b)=>DropdownMenuItem<String>(value:b['id'],child:Text('${b['name']}',overflow:TextOverflow.ellipsis))).toList(),onChanged:(id)=>setState((){branchId=id;normalizeMode();})),
      const SizedBox(height:12),Wrap(spacing:8,children:[for(final mode in ['DELIVERY','PICKUP'])if(branch[mode=='PICKUP'?'pickupEnabled':'deliveryEnabled']==true)ChoiceChip(label:Text(mode=='PICKUP'?'Pickup':'Delivery'),selected:fulfillment==mode,onSelected:(_)=>setState(()=>fulfillment=mode))]),
      const SizedBox(height:16),
      for(final item in items)Card(child:Padding(padding:const EdgeInsets.all(12),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
        CheckboxListTile(key:ValueKey('reorder-${item['id']}'),contentPadding:EdgeInsets.zero,controlAffinity:ListTileControlAffinity.leading,value:selected.contains(item['id']),onChanged:item['status']=='AVAILABLE'?(v)=>setState((){if(v==true)selected.add(item['id']);else selected.remove(item['id']);}):null,title:Text('${item['displayName']??item['product']?['name']??item['previousName']}'),subtitle:Text(item['status']=='AVAILABLE'?'${item['quantity']} × ${money(item['unitPrice'],currency:currency)}':'${item['message']}')),
        if(item['priceChanged']==true)Text('Previous unit price: ${money(item['previousUnitPrice'],currency:currency)}',style:const TextStyle(color:Colors.deepOrange)),
        if(item['product']!=null)TextButton.icon(onPressed:()=>configure(item),icon:const Icon(Icons.tune),label:Text(item['status']=='RECONFIGURE'?'Choose options':'Edit quantity / options')),
      ]))),
      if(error!=null)Text(error!),
    ]),
    bottomNavigationBar:data==null?null:SafeArea(minimum:const EdgeInsets.all(16),child:FilledButton(onPressed:selected.isEmpty?null:openCart,child:Text('Review cart · ${selected.length} selected'))),
  );
}
