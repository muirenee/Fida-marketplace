import 'package:flutter/material.dart';
import 'package:fida_mobile_common/fida_mobile_common.dart';
import '../core/api_client.dart';
import '../ui/format.dart';

class ProductScreen extends StatefulWidget {
 const ProductScreen({super.key,required this.product,required this.currency,this.deliveryMarkup=0,this.initialQuantity=1,this.initialSelectedOptions=const []});
 final Map<String,dynamic> product;
 final String currency;
 final double deliveryMarkup;
 final int initialQuantity;
 final List initialSelectedOptions;
 @override State<ProductScreen> createState()=>_ProductScreenState();
}
class _ProductScreenState extends State<ProductScreen>{
 final selected=<String,int>{};
 int quantity=1;
 List<Map> get options=>(widget.product['options'] as List? ?? []).cast<Map>();
 @override void initState(){
  super.initState();quantity=widget.initialQuantity.clamp(1,50).toInt();
  for(final value in widget.initialSelectedOptions){
   final name=value is String?value:value['name'].toString();
   if(options.any((o)=>o['name']==name))selected[name]=value is String?1:(value['quantity'] as num).toInt();
  }
 }
 Map<String,List<Map>> get groups{
  final result=<String,List<Map>>{};
  for(final o in options){(result[o['group']?.toString()??'Extras']??=[]).add(o);}
  return result;
 }
 bool get valid=>groups.values.every((rows){final count=rows.where((o)=>selected.containsKey(o['name'])).length;return count>=(rows.first['minSelect'] as num? ?? 0)&&count<=(rows.first['maxSelect'] as num? ?? rows.length);});
 double get price=>asDouble(widget.product['price'])+options.fold<double>(0,(sum,o)=>sum+asDouble(o['price'])*(selected[o['name']]??0));
 List<Map<String,dynamic>> get modifierLines=>[for(final o in options)if(selected.containsKey(o['name'])){'name':o['name'],'quantity':selected[o['name']],'unitPrice':asDouble(o['price']),'totalPrice':asDouble(o['price'])*selected[o['name']]!}];
 void setChoice(Map option,List<Map> group,int value){
  setState((){
   final name=option['name'].toString();
   if(value<=0){selected.remove(name);return;}
   if(value>20)return;
   final max=(option['maxSelect'] as num? ?? group.length).toInt();
   if(!selected.containsKey(name)){
    if(max==1){for(final o in group){selected.remove(o['name']);}}
    if(group.where((o)=>selected.containsKey(o['name'])).length>=max)return;
   }
   selected[name]=value;
  });
 }
 @override Widget build(BuildContext context)=>Scaffold(
  body:SafeArea(bottom:false,child:CustomScrollView(slivers:[
   SliverAppBar(expandedHeight:260,pinned:true,leading:IconButton.filledTonal(onPressed:()=>Navigator.pop(context),icon:const Icon(Icons.close)),flexibleSpace:FlexibleSpaceBar(background:Stack(fit:StackFit.expand,children:[
    FoodCover(url:widget.product['imageUrl']?.toString(),baseUrl:ApiClient.baseUrl,height:300,radius:0,label:widget.product['name'].toString()),
    Positioned(left:16,bottom:20,right:100,child:Align(alignment:Alignment.centerLeft,child:ProductOfferBadge(product:widget.product))),
   ]))),
   SliverToBoxAdapter(child:Padding(padding:const EdgeInsets.all(20),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
    Text(widget.product['name'].toString(),style:const TextStyle(fontSize:29,fontWeight:FontWeight.w800)),const SizedBox(height:10),Text(money(asDouble(widget.product['price'])+widget.deliveryMarkup,currency:widget.currency),style:const TextStyle(fontSize:22,fontWeight:FontWeight.w700)),
    const Text('Price includes applicable tax.'),
    if((widget.product['promotions'] as List? ?? []).any((p)=>p['discountType']=='BOGO'))const Padding(padding:EdgeInsets.only(top:12),child:Text('Checkout applies your reward to eligible items or adds it automatically. Rewards requiring choices must be added from the menu. Offer caps and minimum spend apply.')),
    if((widget.product['description']??'').toString().isNotEmpty)Padding(padding:const EdgeInsets.only(top:12),child:Text(widget.product['description'].toString())),
   ]))),
   for(final group in groups.entries)SliverToBoxAdapter(child:Container(padding:const EdgeInsets.all(20),decoration:const BoxDecoration(border:Border(top:BorderSide(color:Color(0xFFF3F3F3),width:8))),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
    Text(group.key,style:const TextStyle(fontSize:22,fontWeight:FontWeight.w800)),
    Text('Choose ${group.value.first['minSelect']??0}–${group.value.first['maxSelect']??group.value.length} different options. Extra quantities are per item.'),
    for(final option in group.value)if(asDouble(option['price'])>0)Padding(padding:const EdgeInsets.symmetric(vertical:12),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
     Text(option['name'].toString(),style:const TextStyle(fontWeight:FontWeight.w700)),const SizedBox(height:6),Wrap(crossAxisAlignment:WrapCrossAlignment.center,spacing:12,runSpacing:8,children:[
      Text('${money(option['price'],currency:widget.currency)} each'),
      QuantityControl(removeAtOne:false,key:ValueKey('modifier-${option['name']}'),value:selected[option['name']]??0,onMinus:(selected[option['name']]??0)>0?()=>setChoice(option,group.value,selected[option['name']]!-1):null,onPlus:(selected[option['name']]??0)<20?()=>setChoice(option,group.value,(selected[option['name']]??0)+1):null),
     ]),
    ]))else CheckboxListTile(contentPadding:EdgeInsets.zero,title:Text(option['name'].toString()),value:selected.containsKey(option['name']),onChanged:(v)=>setChoice(option,group.value,v==true?1:0)),
   ]))),
   SliverToBoxAdapter(child:Padding(padding:const EdgeInsets.all(20),child:Column(children:[
    const Text('Paid item quantity'),const SizedBox(height:8),QuantityControl(removeAtOne:false,value:quantity,onMinus:quantity>1?()=>setState(()=>quantity--):null,onPlus:quantity<50?()=>setState(()=>quantity++):null),
    ModifierBreakdown(lines:modifierLines,currency:widget.currency,multiplier:quantity),
   ]))),
  ])),
  bottomNavigationBar:SafeArea(minimum:const EdgeInsets.all(16),child:FilledButton(onPressed:valid?(){
   final names=selected.keys.toList()..sort();final choices=[for(final name in names){'name':name,'quantity':selected[name]}];
   final labels=names.map((n)=>selected[n]==1?n:'${selected[n]} × $n').join(', ');
   Navigator.pop(context,{'product':{...widget.product,'productId':widget.product['id'],'selectedOptions':choices,'baseUnitPrice':widget.product['price'],'modifierLines':modifierLines,'price':price,'name':'${widget.product['name']}${labels.isEmpty?'':' ($labels)'}'},'quantity':quantity});
  }:null,child:Padding(padding:const EdgeInsets.symmetric(vertical:15),child:Text(valid?'Add $quantity to cart · ${money((price+widget.deliveryMarkup)*quantity,currency:widget.currency)}':'Select required choices',style:const TextStyle(fontSize:17,fontWeight:FontWeight.w700))))),
 );
}
