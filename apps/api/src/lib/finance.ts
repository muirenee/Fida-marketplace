import { issueOrderDocuments } from './documents.js';
import { Prisma } from '@fida/database/client';
export async function recordCompletion(tx: Prisma.TransactionClient, orderId: string) {
 const o=await tx.order.findUniqueOrThrow({where:{id:orderId},include:{delivery:{include:{operator:true}}}});
 const entries=[{kind:'MERCHANDISE_SALE',amount:o.subtotal.minus(o.discount)},{kind:'COMMISSION_DUE',amount:o.platformCommissionAmount}];
 const payment=await tx.paymentAttempt.findUnique({where:{orderId}});
 if(o.paymentMethod !== 'CASH' && payment?.settlementMode !== 'MERCHANT_DIRECT') entries.push({kind:'MERCHANT_PAYABLE',amount:o.subtotal.minus(o.discount).plus(o.tax).minus(o.platformCommissionAmount).plus(o.delivery?.operator?.type==='FIDA'?0:o.deliveryFee)});
 if(o.delivery?.operator?.type==='FIDA')entries.push({kind:'FIDA_DELIVERY_REVENUE',amount:o.deliveryFee});
 for(const e of entries)await tx.financeEntry.upsert({where:{reference:`${orderId}:${e.kind}`},update:{},create:{tenantId:o.tenantId,orderId,reference:`${orderId}:${e.kind}`,...e}});
 await issueOrderDocuments(tx,orderId);
}
