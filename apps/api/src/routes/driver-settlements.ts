import type { FastifyInstance } from 'fastify';
import { prisma } from '@fida/database/client';
import { requireTenant } from '../lib/tenant.js';
export async function driverSettlementRoutes(app: FastifyInstance) {
  app.get('/v1/merchant/driver-settlements',{preHandler:requireTenant(['OWNER','ADMIN'])},async req=>prisma.delivery.findMany({where:{status:'DELIVERED',operator:{tenantId:req.tenantContext!.tenantId}},select:{id:true,estimatedPayout:true,payoutCurrency:true,settledPayout:true,settlementReference:true,settledAt:true,deliveredAt:true,driver:{select:{displayName:true,user:{select:{firstName:true,lastName:true}}}},order:{select:{orderNumber:true,deliveryFee:true,tenant:{select:{currency:true}}}}},orderBy:{deliveredAt:'desc'},take:200}));
  app.post('/v1/merchant/driver-settlements/:id',{preHandler:requireTenant(['OWNER','ADMIN'])},async(req,reply)=>{
    const {id}=req.params as {id:string};const b=req.body as {amount:unknown;reference:unknown};
    const amount=Number(b?.amount),reference=typeof b?.reference==='string'?b.reference.trim():'';
    if(typeof b?.amount!=='number'||!Number.isFinite(amount)||amount<0||amount>100000000||reference.length<3||reference.length>120)return reply.code(400).send({error:'invalid_settlement',message:'Enter the actual paid amount and payment receipt reference.'});
    return prisma.$transaction(async tx=>{
      const row=await tx.delivery.findFirst({where:{id,status:'DELIVERED',operator:{tenantId:req.tenantContext!.tenantId}},include:{order:{select:{tenant:{select:{currency:true}}}}}});
      if(!row) return reply.code(404).send({error:'delivery_not_found'});
      const updated=await tx.delivery.updateMany({where:{id,settledAt:null},data:{settledPayout:amount,settlementReference:`${req.tenantContext!.tenantId}:${reference}`,settledAt:new Date(),payoutCurrency:row.payoutCurrency??row.order.tenant.currency}});
      if(!updated.count)throw Object.assign(new Error('This delivery already has a recorded settlement.'),{statusCode:409});
      return {id,settledPayout:amount,reference};
    });
  });
}
