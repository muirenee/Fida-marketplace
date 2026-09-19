import type { FastifyInstance } from 'fastify';
import { Prisma, prisma } from '@fida/database/client';
import { authenticate, requirePlatformAdmin } from '../lib/auth.js';
import { requireTenant } from '../lib/tenant.js';
import { enqueueOrder } from '../lib/notifications.js';
const active = ['ASSIGNED','AT_PICKUP','PICKED_UP','AT_DROPOFF'] as const;
const input=(v:unknown,n=2000)=>typeof v==='string'?v.trim().slice(0,n):'';
export async function businessOperationsRoutes(app:FastifyInstance){
 app.post('/v1/customer/orders/:id/refund',{preHandler:authenticate},async(req,reply)=>{
  const {id}=req.params as {id:string};const b=(req.body??{})as Record<string,unknown>;
  const order=await prisma.order.findFirst({where:{id,customerId:req.authUser!.id,paymentStatus:'PAID'}});
  if(!order)return reply.code(409).send({error:'paid_order_required'});
  if(!input(b.reason))return reply.code(400).send({error:'reason_required'});
  return prisma.refundRequest.upsert({where:{orderId:id},update:{},create:{orderId:id,tenantId:order.tenantId,customerId:req.authUser!.id,amount:order.total,reason:input(b.reason)}});
 });
 app.get('/v1/customer/refunds',{preHandler:authenticate},async req=>prisma.refundRequest.findMany({where:{customerId:req.authUser!.id},orderBy:{createdAt:'desc'},take:100}));
 app.get('/v1/merchant/refunds',{preHandler:requireTenant(['OWNER','ADMIN'])},async req=>prisma.refundRequest.findMany({where:{tenantId:req.tenantContext!.tenantId},orderBy:{createdAt:'desc'},take:100}));
 app.get('/v1/admin/business/refunds',{preHandler:requirePlatformAdmin},async()=>prisma.refundRequest.findMany({orderBy:{createdAt:'desc'},take:200}));
 // This records a refund actually completed outside Fida; it never moves money.
 app.patch('/v1/admin/business/refunds/:id',{preHandler:requirePlatformAdmin},async(req,reply)=>{
  const {id}=req.params as {id:string};const b=(req.body??{})as Record<string,unknown>;
  if(!['APPROVED','REJECTED','REFUNDED'].includes(String(b.status))||!input(b.resolution))return reply.code(400).send({error:'resolution_required'});
  const refund=await prisma.refundRequest.findUnique({where:{id}});if(!refund)return reply.code(404).send({error:'refund_not_found'});
  if(refund.status==='REFUNDED')return reply.code(409).send({error:'already_refunded'});
  if(b.status==='REFUNDED'&&(refund.status!=='APPROVED'||!input(b.externalReference,120)))return reply.code(409).send({error:'approval_and_receipt_required',message:'Approve the request, complete the refund with your provider, then enter its transaction receipt.'});
  return prisma.$transaction(async tx=>{
   const changed=await tx.refundRequest.updateMany({where:{id,status:refund.status},data:{status:String(b.status),resolution:input(b.resolution),...(b.status==='REFUNDED'?{externalReference:input(b.externalReference,120)}:{})}});
   if(!changed.count)throw Object.assign(new Error('Refund changed. Refresh and retry.'),{statusCode:409});
   if(b.status==='REFUNDED'){
    const order = await tx.order.findUniqueOrThrow({where:{id:refund.orderId}});
    if(!['COMPLETED','CANCELLED','REJECTED'].includes(order.status))throw Object.assign(new Error('Close or cancel fulfillment before recording the refund.'),{statusCode:409});
    await tx.order.update({where:{id:refund.orderId},data:{paymentStatus:'REFUNDED'}});
    await tx.financeEntry.create({data:{tenantId:refund.tenantId,orderId:refund.orderId,kind:'REFUND',amount:refund.amount.negated(),reference:`refund:${id}`,actorId:req.authUser!.id,note:input(b.externalReference,120)}});
    const commission=await tx.financeEntry.findUnique({where:{reference:`${refund.orderId}:COMMISSION_DUE`}});
    if(commission)await tx.financeEntry.create({data:{tenantId:refund.tenantId,orderId:refund.orderId,kind:'COMMISSION_REVERSAL',amount:commission.amount.negated(),reference:`refund:${id}:commission`,actorId:req.authUser!.id}});
    const payable=await tx.financeEntry.findUnique({where:{reference:`${refund.orderId}:MERCHANT_PAYABLE`}});
    if(payable)await tx.financeEntry.create({data:{tenantId:refund.tenantId,orderId:refund.orderId,kind:'PAYOUT_REVERSAL',amount:payable.amount.negated(),reference:`refund:${id}:payout`,actorId:req.authUser!.id}});
    await enqueueOrder(tx,refund.orderId,'REFUNDED');
   }
   return tx.refundRequest.findUniqueOrThrow({where:{id}});
  });
 });
 app.get('/v1/admin/business/ledger',{preHandler:requirePlatformAdmin},async()=>prisma.financeEntry.findMany({take:1000,orderBy:{createdAt:'desc'}}));
 app.get('/v1/merchant/statement',{preHandler:requireTenant(['OWNER','ADMIN'])},async req=>{
  const groups=await prisma.financeEntry.groupBy({by:['kind'],where:{tenantId:req.tenantContext!.tenantId},_sum:{amount:true}});
  const amount=(kind:string)=>Number(groups.find(g=>g.kind===kind)?._sum.amount??0);
  return {groups,commissionOutstanding:amount('COMMISSION_DUE')+amount('COMMISSION_REVERSAL')-amount('COMMISSION_REMITTANCE'),merchantPayoutOutstanding:amount('MERCHANT_PAYABLE')+amount('PAYOUT_REVERSAL')-amount('MERCHANT_PAYOUT')};
 });
 app.get('/v1/admin/business/fleet',{preHandler:requirePlatformAdmin},async()=>({drivers:await prisma.driver.findMany({where:{operator:{type:'FIDA'}},include:{user:{select:{email:true,firstName:true,lastName:true,phone:true}},operator:true}}),deliveries:await prisma.delivery.findMany({where:{status:{in:['UNASSIGNED',...active]},order:{branch:{logisticsMode:{in:['FIDA','HYBRID']}}}},include:{order:{select:{orderNumber:true,status:true,branchId:true,tenantId:true}}},take:200})}));
 app.post('/v1/admin/business/fleet/enroll',{preHandler:requirePlatformAdmin},async(req,reply)=>{
  const b=(req.body??{})as Record<string,unknown>,email=input(b.email).toLowerCase();
  const user=await prisma.user.findUnique({where:{email},include:{driver:{include:{operator:true}}}});
  if(!user?.isActive||user.isPlatformAdmin)return reply.code(404).send({error:'active_driver_user_required'});
  if(user.driver?.operator?.type==='MERCHANT')return reply.code(409).send({error:'merchant_driver_cannot_be_transferred'});
  if(user.driver)return reply.code(409).send({error:'already_enrolled'});
  return prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(710071)`;
   let fleet=await tx.deliveryOperator.findFirst({where:{type:'FIDA',tenantId:null,isActive:true}});
   fleet??=await tx.deliveryOperator.create({data:{name:'Fida fleet',type:'FIDA'}});
   return tx.driver.create({data:{userId:user.id,operatorId:fleet.id},include:{user:{select:{email:true,firstName:true,lastName:true}}}});
  });
 });
 app.post('/v1/admin/business/fleet/dispatch',{preHandler:requirePlatformAdmin},async(req,reply)=>{
  const b=(req.body??{})as Record<string,unknown>,deliveryId=input(b.deliveryId),driverId=input(b.driverId);
  const driver=await prisma.driver.findFirst({where:{id:driverId,isActive:true,isOnline:true,isAvailable:true,user:{isActive:true},operator:{type:'FIDA',isActive:true}}});
  if(!driver)return reply.code(409).send({error:'available_fida_driver_required'});
  return prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT 1 FROM "Driver" WHERE id=${driverId} FOR UPDATE`;
   const currentDriver=await tx.driver.findFirst({where:{id:driverId,isActive:true,isOnline:true,isAvailable:true,user:{isActive:true},operator:{type:'FIDA',isActive:true}}});
   if(!currentDriver)throw Object.assign(new Error('Driver availability changed.'),{statusCode:409});
   const count=await tx.delivery.count({where:{driverId,status:{in:[...active]}}});if(count>=currentDriver.maxConcurrentOrders)throw Object.assign(new Error('Driver capacity reached.'),{statusCode:409});
   const moved=await tx.delivery.updateMany({where:{id:deliveryId,driverId:null,status:'UNASSIGNED',order:{status:'READY_FOR_PICKUP',branch:{logisticsMode:{in:['FIDA','HYBRID']}}}},data:{driverId,operatorId:driver.operatorId,status:'ASSIGNED',assignedAt:new Date()}});
   if(!moved.count)throw Object.assign(new Error('This delivery is no longer available.'),{statusCode:409});
   const delivery=await tx.delivery.findUniqueOrThrow({where:{id:deliveryId}});await enqueueOrder(tx,delivery.orderId,'DRIVER_ASSIGNED');return delivery;
  });
 });
 app.post('/v1/admin/business/payouts',{preHandler:requirePlatformAdmin},async(req,reply)=>{
  const b=(req.body??{})as Record<string,unknown>,tenantId=input(b.tenantId),reference=input(b.reference,120),amount=Number(b.amount);
  if(!reference||!Number.isFinite(amount)||amount<=0)return reply.code(400).send({error:'amount_and_receipt_required'});
  return prisma.$transaction(async tx=>{
   await tx.$executeRaw`SELECT 1 FROM "Tenant" WHERE id=${tenantId} FOR UPDATE`;
   const entries=await tx.financeEntry.groupBy({by:['kind'],where:{tenantId,kind:{in:['MERCHANT_PAYABLE','PAYOUT_REVERSAL','MERCHANT_PAYOUT']}},_sum:{amount:true}});
   const total=entries.reduce((sum,e)=>sum+(e.kind==='MERCHANT_PAYOUT'?-1:1)*Number(e._sum.amount??0),0);
   if(amount>total)throw Object.assign(new Error('Amount exceeds the merchant payout balance.'),{statusCode:409});
   return tx.financeEntry.create({data:{tenantId,kind:'MERCHANT_PAYOUT',amount,reference:`payout:${reference}`,note:input(b.note),actorId:req.authUser!.id}});
  });
 });
 app.patch('/v1/admin/business/tenants/:id/tax',{preHandler:requirePlatformAdmin},async(req,reply)=>{
  const {id}=req.params as {id:string};const b=(req.body??{})as Record<string,unknown>,taxPercent=Number(b.taxPercent);
  if(!Number.isFinite(taxPercent)||taxPercent<0||taxPercent>100)return reply.code(400).send({error:'invalid_tax_rate'});
  return prisma.tenant.update({where:{id},data:{taxPercent},select:{id:true,name:true,taxPercent:true}});
 });
 app.get('/v1/admin/business/performance',{preHandler:requirePlatformAdmin},async()=>{
  const since=new Date(Date.now()-30*86400000);
  const [orders,deliveries,reviews,support,notifications,repeat]=await Promise.all([
   prisma.order.groupBy({by:['status'],where:{createdAt:{gte:since}},_count:{_all:true},_sum:{total:true}}),
   prisma.delivery.findMany({where:{deliveredAt:{gte:since}},select:{assignedAt:true,deliveredAt:true},take:10000}),
   prisma.review.aggregate({_avg:{rating:true},_count:{_all:true},where:{createdAt:{gte:since}}}),
   prisma.supportCase.groupBy({by:['status'],_count:{_all:true}}),
   prisma.notificationEvent.count({where:{sentAt:null}}),
   prisma.order.groupBy({by:['customerId'],where:{createdAt:{gte:since},status:'COMPLETED'},_count:{_all:true}}),
  ]);
  const durations=deliveries.filter(d=>d.assignedAt&&d.deliveredAt).map(d=>(d.deliveredAt!.getTime()-d.assignedAt!.getTime())/60000);
  return {windowDays:30,orders,meanDeliveryMinutes:durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:null,deliverySample:durations.length,reviews,support,pendingPushEvents:notifications,customers:repeat.length,repeatCustomers:repeat.filter(c=>c._count._all>1).length};
 });
}
