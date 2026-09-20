import type { FastifyInstance } from 'fastify';
import { Prisma, prisma } from '@fida/database/client';
import { authenticate, requirePlatformAdmin } from '../lib/auth.js';
import { requireTenant } from '../lib/tenant.js';
import { issueOrderDocuments } from '../lib/documents.js';
export async function documentRoutes(app:FastifyInstance){
 app.get('/v1/customer/orders/:id/receipt',{preHandler:authenticate},async(req,reply)=>{
  const {id}=req.params as {id:string};
  const order=await prisma.order.findFirst({where:{id,customerId:req.authUser!.id}});
  if(!order)return reply.code(404).send({error:'order_not_found'});
  if(order.status!=='COMPLETED')return reply.code(409).send({error:'receipt_pending',message:'Your receipt is issued when the order is completed.'});
  await prisma.$transaction(tx=>issueOrderDocuments(tx,id));
  const receipt=await prisma.businessDocument.findUniqueOrThrow({where:{orderId_kind:{orderId:id,kind:'CUSTOMER_RECEIPT'}}});
  return {...receipt,creditNotes:await prisma.businessDocument.findMany({where:{orderId:id,kind:'CUSTOMER_CREDIT'}})};
 });
 app.get('/v1/merchant/documents',{preHandler:requireTenant(['OWNER','ADMIN'])},async req=>prisma.businessDocument.findMany({where:{tenantId:req.tenantContext!.tenantId,kind:{in:['COMMISSION_INVOICE','COMMISSION_CREDIT']}},orderBy:{issuedAt:'desc'},take:200}));
 app.get('/v1/admin/business/commission-balances',{preHandler:requirePlatformAdmin},async()=>{
  const [tenants,entries,documents]=await Promise.all([
   prisma.tenant.findMany({select:{id:true,name:true,currency:true},orderBy:{name:'asc'}}),
   prisma.financeEntry.groupBy({by:['tenantId','kind'],where:{kind:{in:['COMMISSION_DUE','COMMISSION_REVERSAL','COMMISSION_REMITTANCE']}},_sum:{amount:true}}),
   prisma.businessDocument.findMany({where:{kind:{in:['COMMISSION_INVOICE','COMMISSION_CREDIT']}},orderBy:{issuedAt:'desc'},take:1000})
  ]);
  return tenants.map(t=>({...t,outstanding:entries.filter(e=>e.tenantId===t.id).reduce((total,e)=>e.kind==='COMMISSION_REMITTANCE'?total.minus(e._sum.amount??0):total.plus(e._sum.amount??0),new Prisma.Decimal(0)),documents:documents.filter(d=>d.tenantId===t.id)}));
 });
 app.get('/v1/admin/business/documents',{preHandler:requirePlatformAdmin},async()=>prisma.businessDocument.findMany({orderBy:{issuedAt:'desc'},take:500}));
 app.post('/v1/merchant/orders/:id/invoice',{preHandler:requireTenant(['OWNER','ADMIN'])},async(req,reply)=>{
  const {id}=req.params as {id:string};
  const order=await prisma.order.findFirst({where:{id,tenantId:req.tenantContext!.tenantId,status:'COMPLETED'}});
  if(!order)return reply.code(404).send({error:'completed_order_not_found'});
  await prisma.$transaction(tx=>issueOrderDocuments(tx,id));
  return prisma.businessDocument.findUniqueOrThrow({where:{orderId_kind:{orderId:id,kind:'COMMISSION_INVOICE'}}});
 });
}
