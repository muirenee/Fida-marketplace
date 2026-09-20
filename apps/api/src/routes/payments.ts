import {runtimeSettings} from '../lib/runtime-settings.js';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Prisma, prisma } from '@fida/database/client';
import { authenticate } from '../lib/auth.js';
import { enqueueOrder } from '../lib/notifications.js';

async function flutterwave(path: string, body?: unknown) {
 const r = await fetch(`https://api.flutterwave.com/v3/${path}`, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`, 'content-type':'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
 const data=await r.json() as { status: string; data?: Record<string,any> };
 if(!r.ok||data.status!=='success'||!data.data)throw Object.assign(new Error('The payment provider is unavailable. Try again shortly.'),{statusCode:502});
 return data.data;
}
export async function verifyPayment(transactionId: string) {
 if(!/^\d+$/.test(transactionId))return false;
 const result=await flutterwave(`transactions/${transactionId}/verify`);
 if(result.status!=='successful'||typeof result.tx_ref!=='string')return false;
 const attempt=await prisma.paymentAttempt.findUnique({where:{reference:result.tx_ref}});if(!attempt)return false;
 const order=await prisma.order.findUnique({where:{id:attempt.orderId},include:{tenant:{select:{currency:true}}}});if(!order)return false;
 if(result.currency!==order.tenant.currency || !new Prisma.Decimal(String(result.amount)).equals(order.total))return false;
 await prisma.$transaction(async tx=>{
  const updated=await tx.paymentAttempt.updateMany({where:{id:attempt.id,status:{not:'PAID'}},data:{status:'PAID',providerTransactionId:transactionId}});if(!updated.count)return;
  await tx.order.update({where:{id:order.id},data:{paymentStatus:'PAID'}});
  await tx.financeEntry.upsert({where:{reference:`${order.id}:ONLINE_PAYMENT`},update:{},create:{tenantId:order.tenantId,orderId:order.id,kind:'ONLINE_PAYMENT',amount:order.total,reference:`${order.id}:ONLINE_PAYMENT`}});
  if(['CANCELLED','REJECTED'].includes(order.status))await tx.supportCase.create({data:{orderId:order.id,tenantId:order.tenantId,userId:order.customerId,subject:'Refund required for late payment',description:'Online payment completed after cancellation. Verify and refund through the payment provider.'}});
  await enqueueOrder(tx,order.id,'PAYMENT_CONFIRMED');
 });
 return true;
}
export async function paymentRoutes(app: FastifyInstance) {
 app.get('/v1/payments/methods',async req=>{
  const {tenantId}=req.query as {tenantId?:string};
  const merchant=tenantId?await prisma.tenant.findFirst({where:{id:tenantId,status:'ACTIVE'},select:{paymentSubaccount:true}}):null;
  return {methods:merchant?.paymentSubaccount&&process.env.FLUTTERWAVE_SECRET_KEY&&process.env.FLUTTERWAVE_WEBHOOK_SECRET?['CASH','MOBILE_MONEY','CARD']:['CASH']};
 });
 app.post('/v1/customer/orders/:id/payment',{preHandler:authenticate},async(req,reply)=>{
  if(!process.env.FLUTTERWAVE_SECRET_KEY||!process.env.FLUTTERWAVE_WEBHOOK_SECRET)return reply.code(503).send({error:'payments_not_configured'});
  const {id}=req.params as {id:string};
  const order=await prisma.order.findFirst({where:{id,customerId:req.authUser!.id},include:{tenant:{select:{currency:true,paymentSubaccount:true}},customer:{select:{email:true,phone:true,firstName:true,lastName:true}}}});
  if(!order)return reply.code(404).send({error:'order_not_found'});
  if(order.paymentMethod==='CASH'||order.paymentStatus==='PAID'||order.status!=='PENDING')return reply.code(409).send({error:'order_not_payable'});
  if(!order.tenant.paymentSubaccount)return reply.code(409).send({error:'merchant_payment_destination_required'});
  const attempt=await prisma.paymentAttempt.upsert({where:{orderId:id},update:{},create:{orderId:id,customerId:req.authUser!.id,reference:`fida-${id}`,provider:'FLUTTERWAVE',settlementMode:'MERCHANT_DIRECT',destinationSubaccount:order.tenant.paymentSubaccount}});
  if(attempt.settlementMode!=='MERCHANT_DIRECT'||!attempt.destinationSubaccount)return reply.code(409).send({error:'legacy_payment_review_required',message:'This older payment attempt needs administrator review before payment.'});
  if(attempt.checkoutUrl)return {url:attempt.checkoutUrl};
  const data=await flutterwave('payments',{subaccounts:[{id:attempt.destinationSubaccount,transaction_charge_type:'flat',transaction_charge:0}],tx_ref:attempt.reference,amount:order.total.toString(),currency:order.tenant.currency,redirect_url:`${(await runtimeSettings()).PUBLIC_BASE_URL||'https://marketplaceadmin.fidalix.com'}/v1/payments/return`,payment_options:order.paymentMethod==='CARD'?'card':'mobilemoneyrwanda',customer:{email:order.customer.email,phonenumber:order.customer.phone,name:[order.customer.firstName,order.customer.lastName].filter(Boolean).join(' ')},customizations:{title:'Fida Marketplace',description:order.orderNumber}});
  const link=String(data.link??'');if(!link.startsWith('https://'))throw Error('Invalid checkout URL');
  await prisma.paymentAttempt.update({where:{id:attempt.id},data:{checkoutUrl:link}});return {url:link};
 });
 app.get('/v1/payments/return',async(req,reply)=>{
  const q=req.query as Record<string,string>;let verified=false;
  if(q.transaction_id&&process.env.FLUTTERWAVE_SECRET_KEY)verified=await verifyPayment(q.transaction_id);
  return reply.type('text/html').send(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fida payment</title><body style="font-family:Arial;padding:40px;background:#f3f8f2"><h1>${verified?'Payment confirmed':'Payment awaiting confirmation'}</h1><p>Return to the Fida Marketplace app and open your order for its latest status.</p></body></html>`);
 });
 app.post('/v1/payments/webhook',async(req,reply)=>{
  const secret=process.env.FLUTTERWAVE_WEBHOOK_SECRET,header=req.headers['verif-hash'];
  if(!secret||typeof header!=='string'||Buffer.byteLength(secret)!==Buffer.byteLength(header)||!timingSafeEqual(Buffer.from(secret),Buffer.from(header)))return reply.code(401).send({error:'invalid_signature'});
  const body=req.body as {event?:string;data?:{id?:number}};
  if(body?.event==='charge.completed'&&body.data?.id)await verifyPayment(String(body.data.id));
  return {received:true};
 });
}
