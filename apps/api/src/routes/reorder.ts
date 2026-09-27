import type {FastifyInstance} from 'fastify';
import {prisma} from '@fida/database/client';
import {authenticate} from '../lib/auth.js';
import {selectedOptions} from '../lib/product-options.js';

export async function reorderRoutes(app:FastifyInstance){
 app.get('/v1/customer/orders/:orderId/reorder',{preHandler:authenticate},async(req,reply)=>{
  const {orderId}=req.params as {orderId:string};
  const order=await prisma.order.findFirst({where:{id:orderId,customerId:req.authUser!.id},include:{items:true}});
  if(!order)return reply.code(404).send({error:'order_not_found'});
  if(!['COMPLETED','CANCELLED','REJECTED'].includes(order.status))return reply.code(409).send({error:'order_still_active',message:'This order is still active. Open its tracking screen.'});
  const merchant=await prisma.tenant.findFirst({where:{id:order.tenantId,status:'ACTIVE',isAcceptingOrders:true},select:{id:true,name:true,slug:true,currency:true,minimumOrder:true,branches:{where:{isActive:true,isAcceptingOrders:true,OR:[{pickupEnabled:true},{deliveryEnabled:true}]},select:{id:true,name:true,pickupEnabled:true,deliveryEnabled:true,city:true,addressLine:true},orderBy:{name:'asc'}}}});
  if(!merchant||!merchant.branches.length)return reply.code(409).send({error:'merchant_unavailable',message:'This store is not accepting orders.'});
  const products=await prisma.product.findMany({where:{tenantId:merchant.id,id:{in:order.items.flatMap(i=>i.productId?[i.productId]:[])},isActive:true,isAvailable:true,deletedAt:null,OR:[{categoryId:null},{category:{isActive:true,deletedAt:null}}]},select:{id:true,name:true,description:true,imageUrl:true,price:true,options:true}});
  const items=order.items.map(item=>{
   const product=products.find(p=>p.id===item.productId);
   const base={id:item.id,quantity:item.quantity,previousName:item.productName,previousUnitPrice:item.unitPrice};
   if(!product)return {...base,status:'UNAVAILABLE',message:'This item is no longer available.',product:null};
   // Old order names are display snapshots, never a reliable modifier identifier.
   if(item.selectedOptions===null&&Array.isArray(product.options)&&product.options.length)return {...base,status:'RECONFIGURE',message:'Choose current options for this older order.',product};
   try{
    const current=selectedOptions(product,item.selectedOptions??[]);
    return {...base,status:'AVAILABLE',message:null,product,selectedOptions:current.selectedOptions,unitPrice:current.price,displayName:current.name,priceChanged:!current.price.equals(item.unitPrice)};
   }catch{return {...base,status:'RECONFIGURE',message:'The choices changed. Select your options again.',product};}
  });
  return {orderNumber:order.orderNumber,merchant,branchId:merchant.branches.some(b=>b.id===order.branchId)?order.branchId:merchant.branches[0].id,fulfillmentType:order.fulfillmentType,items};
 });
}
