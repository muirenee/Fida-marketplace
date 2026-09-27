import 'package:flutter/material.dart';

class DeliveryRouteSummary extends StatelessWidget {
  const DeliveryRouteSummary({super.key,required this.order});
  final Map order;
  Widget stop(BuildContext context,String label,String text,IconData icon,Color color)=>Padding(
    padding:const EdgeInsets.symmetric(vertical:8),
    child:Row(crossAxisAlignment:CrossAxisAlignment.start,children:[
      Container(width:40,height:40,decoration:BoxDecoration(color:color.withValues(alpha:.12),borderRadius:BorderRadius.circular(12)),child:Icon(icon,color:color)),
      const SizedBox(width:12),Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text(label,style:Theme.of(context).textTheme.labelMedium?.copyWith(color:color,fontWeight:FontWeight.w700)),const SizedBox(height:3),Text(text,style:const TextStyle(fontWeight:FontWeight.w600))])),
    ]),
  );
  @override
  Widget build(BuildContext context){
    final branch=order['branch'] as Map? ?? {},tenant=order['tenant'] as Map? ?? {};
    final pickup=[tenant['name'],branch['addressLine'],branch['city']].where((s)=>s!=null&&'$s'.isNotEmpty).join(' · ');
    final payment=order['paymentStatus']?.toString();
    return Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
      stop(context,'1 · Pickup',pickup.isEmpty?'Pickup location unavailable':pickup,Icons.storefront_outlined,const Color(0xFF07855A)),
      stop(context,'2 · Drop-off','${order['deliveryAddress']??'Delivery location unavailable'}',Icons.location_on_outlined,const Color(0xFFB65C16)),
      if(order['paymentMethod']!=null)Container(width:double.infinity,padding:const EdgeInsets.all(12),margin:const EdgeInsets.only(top:8),decoration:BoxDecoration(color:Theme.of(context).colorScheme.surfaceContainerHighest,borderRadius:BorderRadius.circular(12)),child:Wrap(spacing:12,runSpacing:6,children:[
        Text('Payment: ${order['paymentMethod'].toString().replaceAll('_',' ')}'),
        Text(payment=='PAID'?'Paid':payment=='REFUNDED'?'Refunded':payment==null||payment=='PENDING'?'Payment pending':payment.toLowerCase().replaceAll('_',' '),style:const TextStyle(fontWeight:FontWeight.w700)),
        if(order['total']!=null)Text('Order total: ${order['total']} ${tenant['currency']??'RWF'}'),
      ])),
    ]);
  }
}
