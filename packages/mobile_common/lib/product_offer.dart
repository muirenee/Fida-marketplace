import 'package:flutter/material.dart';

class ProductOfferBadge extends StatelessWidget {
 const ProductOfferBadge({super.key,required this.product});
 final Map product;
 @override Widget build(BuildContext context){
  final offers=(product['promotions'] as List? ?? []).where((p)=>p['discountType']=='BOGO').toList()..sort((a,b)=>(a['buyQuantity'] as num? ?? 1).compareTo(b['buyQuantity'] as num? ?? 1));
  if(offers.isEmpty)return const SizedBox.shrink();
  final text='Buy ${offers.first['buyQuantity']??1}, get 1 free';
  return Semantics(label:text,child:Container(padding:const EdgeInsets.symmetric(horizontal:7,vertical:6),decoration:BoxDecoration(color:const Color(0xFFC82216),borderRadius:BorderRadius.circular(5)),child:Text(text,style:const TextStyle(color:Colors.white,fontWeight:FontWeight.w800,fontSize:11),softWrap:true)));
 }
}

class ModifierBreakdown extends StatelessWidget {
 const ModifierBreakdown({super.key,required this.lines,required this.currency,this.multiplier=1});
 final List lines;
 final String currency;
 final int multiplier;
 @override Widget build(BuildContext context)=>Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
  for(final m in lines)if((double.tryParse('${m['unitPrice']}')??0)>0)Padding(padding:const EdgeInsets.only(top:4),child:Text('${(m['quantity'] as num).toInt()*multiplier} × ${m['name']} · ${m['unitPrice']} $currency each = ${((double.tryParse('${m['unitPrice']}')??0)*(m['quantity'] as num)*multiplier).toStringAsFixed(2)} $currency',style:Theme.of(context).textTheme.bodySmall)),
 ]);
}
