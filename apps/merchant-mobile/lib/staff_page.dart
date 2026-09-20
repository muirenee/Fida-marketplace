import 'package:flutter/material.dart';
import 'api_client.dart';

class StaffPage extends StatefulWidget {
 const StaffPage({super.key,required this.api,required this.tenantId,required this.owner,this.branchId});
 final MerchantApiClient api;final String tenantId;final bool owner;final String? branchId;
 @override State<StaffPage> createState()=>_StaffPageState();
}
class _StaffPageState extends State<StaffPage>{
 List<dynamic> rows=[],branches=[];bool busy=true;String? error;
 Future<dynamic> call(String path,{String method='GET',Object? body})=>widget.api.request(method,'/v1/merchant/$path',tenantId:widget.tenantId,body:body);
 @override void initState(){super.initState();load();}
 Future<void> load()async{try{final data=await Future.wait([call('staff'),call('fulfillment')]);if(mounted)setState((){rows=data[0] as List;branches=(data[1] as List).where((b)=>widget.owner||widget.branchId==null||b['id']==widget.branchId).toList();error=null;});}catch(e){if(mounted)setState(()=>error='$e');}finally{if(mounted)setState(()=>busy=false);}}
 Future<void> change(Map row,String method,Object? body)async{setState(()=>busy=true);try{await call('staff/${row['id']}',method:method,body:body);await load();}catch(e){if(mounted)setState(()=>error='$e');}finally{if(mounted)setState(()=>busy=false);}}
 Future<void> edit([Map? row])async{
  final name=TextEditingController(text:row?['user']?['firstName']??''),email=TextEditingController(),password=TextEditingController();
  String role=row?['role']??'STAFF';String? branch=row?['branchId']??widget.branchId,localError;bool saving=false;
  await showDialog<void>(context:context,builder:(c)=>StatefulBuilder(builder:(c,update)=>AlertDialog(title:Text(row==null?'Create staff':'Edit staff'),content:SingleChildScrollView(child:Column(mainAxisSize:MainAxisSize.min,children:[
   TextField(controller:name,decoration:const InputDecoration(labelText:'First name'),maxLength:80),
   if(row==null)...[TextField(controller:email,keyboardType:TextInputType.emailAddress,decoration:const InputDecoration(labelText:'Email')),TextField(controller:password,obscureText:true,decoration:const InputDecoration(labelText:'Initial password (12+ characters)'))],
   DropdownButtonFormField<String>(initialValue:role,decoration:const InputDecoration(labelText:'Role'),items:[for(final r in ['STAFF','KITCHEN_CREW',if(widget.owner)'MANAGER'])DropdownMenuItem(value:r,child:Text(r.replaceAll('_',' ')))],onChanged:saving?null:(v)=>update(()=>role=v!)),
   if(widget.owner||row==null)DropdownButtonFormField<String>(initialValue:branch??'',decoration:const InputDecoration(labelText:'Branch'),items:[if(widget.owner||widget.branchId==null)const DropdownMenuItem(value:'',child:Text('All branches')),for(final b in branches)DropdownMenuItem(value:b['id'].toString(),child:Text(b['name'].toString()))],onChanged:saving?null:(v)=>update(()=>branch=v==''?null:v)),
   if(localError!=null)Text(localError!,style:const TextStyle(color:Colors.red)),
  ])),actions:[TextButton(onPressed:saving?null:()=>Navigator.pop(c),child:const Text('Cancel')),FilledButton(onPressed:saving?null:()async{update(()=>saving=true);try{await call(row==null?'staff':'staff/${row['id']}',method:row==null?'POST':'PATCH',body:{'firstName':name.text.trim(),'role':role,if(row==null||widget.owner)'branchId':branch,if(row==null)'email':email.text.trim(),if(row==null)'password':password.text});if(c.mounted)Navigator.pop(c);await load();}catch(e){if(c.mounted)update(()=>localError='$e');}finally{if(c.mounted)update(()=>saving=false);}},child:Text(saving?'Saving…':'Save'))])));
 }
 @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Staff accounts')),floatingActionButton:FloatingActionButton.extended(onPressed:busy?null:()=>edit(),icon:const Icon(Icons.person_add),label:const Text('Add staff')),body:RefreshIndicator(onRefresh:load,child:ListView(padding:const EdgeInsets.fromLTRB(16,16,16,100),children:[if(busy)const LinearProgressIndicator(),if(error!=null)Text(error!,style:const TextStyle(color:Colors.red)),for(final raw in rows)Builder(builder:(_){final r=raw as Map;final editable=['STAFF','KITCHEN_CREW',if(widget.owner)'MANAGER'].contains(r['role']);return Card(child:Padding(padding:const EdgeInsets.all(16),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text('${r['user']['firstName']??r['user']['email']}',style:const TextStyle(fontSize:18,fontWeight:FontWeight.bold)),Text('${r['user']['email']}\n${r['role']} · ${r['isActive']==true?'Active':'Suspended'}'),if(editable)Wrap(spacing:8,children:[TextButton(onPressed:busy?null:()=>edit(r),child:const Text('Edit')),TextButton(onPressed:busy?null:()=>change(r,'PATCH',{'isActive':r['isActive']!=true}),child:Text(r['isActive']==true?'Suspend':'Activate')),TextButton(onPressed:busy?null:()async{final ok=await showDialog<bool>(context:context,builder:(c)=>AlertDialog(title:const Text('Delete staff membership?'),content:const Text('This removes access to this store.'),actions:[TextButton(onPressed:()=>Navigator.pop(c,false),child:const Text('Cancel')),FilledButton(onPressed:()=>Navigator.pop(c,true),child:const Text('Delete'))]));if(ok==true)await change(r,'DELETE',{});},child:const Text('Delete'))])])));})])));
}
