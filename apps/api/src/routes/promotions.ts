import type { FastifyInstance } from 'fastify';
import { prisma } from '@fida/database/client';
import { requireTenant, merchantWriteRoles } from '../lib/tenant.js';
import { requirePlatformAdmin } from '../lib/auth.js';
const fail=(message:string):never=>{throw Object.assign(new Error(message),{statusCode:400});};
export async function promotionRoutes(app:FastifyInstance){
 app.get('/v1/merchant/promotions',{preHandler:requireTenant(merchantWriteRoles)},async req=>prisma.promotion.findMany({where:{tenantId:req.tenantContext!.tenantId},orderBy:{expiresAt:'desc'}}));
 app.post('/v1/merchant/promotions',{preHandler:requireTenant(merchantWriteRoles)},async(req,reply)=>{
  const b=(req.body??{}) as Record<string,unknown>,tenantId=req.tenantContext!.tenantId;
  const code=typeof b.code==='string'?b.code.trim().toUpperCase():'',discountType=b.discountType??'PERCENT';
  const percent=discountType==='PERCENT'?Number(b.percent):0,flatAmount=discountType==='FLAT'?Number(b.flatAmount):0;
  const maxUses=Number(b.maxUses),maxDiscount=Number(b.maxDiscount),minimumOrder=Number(b.minimumOrder??0),expiresAt=new Date(String(b.expiresAt));
  const policy=await prisma.promotionPolicy.findUnique({where:{id:'platform'}});
  if(!/^[A-Z0-9_-]{3,32}$/.test(code)||!['FLAT','PERCENT'].includes(String(discountType))||!Number.isInteger(percent)||percent<0||percent>(policy?.maxPercent??100)||(discountType==='PERCENT'&&percent<1)||!Number.isFinite(flatAmount)||flatAmount<0||(discountType==='FLAT'&&flatAmount<=0)||!Number.isInteger(maxUses)||maxUses<1||maxUses>100000||!Number.isFinite(maxDiscount)||maxDiscount<=0||maxDiscount>Number(policy?.maxDiscount??100000000)||flatAmount>maxDiscount||!Number.isFinite(minimumOrder)||minimumOrder<0||minimumOrder>100000000||!Number.isFinite(expiresAt.getTime())||expiresAt<=new Date())return fail('Invalid promotion values or platform promotion limits exceeded.');
  const productId=typeof b.productId==='string'&&b.productId?b.productId:null;
  if(productId&&!await prisma.product.findFirst({where:{id:productId,tenantId,deletedAt:null}}))return fail('Choose a product owned by this merchant.');
  if(b.stackable!==undefined&&typeof b.stackable!=='boolean')return fail('Invalid stacking choice.');
  const stackable=b.stackable!==false&&policy?.allowStacking!==false;
  if(await prisma.promotion.findUnique({where:{tenantId_code:{tenantId,code}}}))return reply.code(409).send({error:'promo_code_in_use'});
  return reply.code(201).send(await prisma.promotion.create({data:{tenantId,code,productId,discountType:String(discountType),percent,flatAmount,maxUses,maxDiscount,minimumOrder,expiresAt,stackable}}));
 });
 app.patch('/v1/merchant/promotions/:id',{preHandler:requireTenant(merchantWriteRoles)},async(req,reply)=>{
  const {id}=req.params as {id:string};const b=req.body as {isActive:boolean};if(typeof b?.isActive!=='boolean')return fail('Provide isActive.');
  const r=await prisma.promotion.updateMany({where:{id,tenantId:req.tenantContext!.tenantId},data:{isActive:b.isActive}});
  if(!r.count)return reply.code(404).send({error:'promotion_not_found'});return {updated:true};
 });
 app.get('/v1/admin/promotion-policy',{preHandler:requirePlatformAdmin},async()=>await prisma.promotionPolicy.findUnique({where:{id:'platform'}})??{maxPercent:100,maxDiscount:100000000,allowStacking:true});
 app.patch('/v1/admin/promotion-policy',{preHandler:requirePlatformAdmin},async req=>{
  const b=req.body as {maxPercent:number;maxDiscount:number;allowStacking:boolean};
  if(!b||!Number.isInteger(b.maxPercent)||b.maxPercent<1||b.maxPercent>100||!Number.isFinite(b.maxDiscount)||b.maxDiscount<=0||b.maxDiscount>100000000||typeof b.allowStacking!=='boolean')return fail('Invalid platform promotion limits.');
  const data={maxPercent:b.maxPercent,maxDiscount:b.maxDiscount,allowStacking:b.allowStacking};
  return prisma.promotionPolicy.upsert({where:{id:'platform'},create:{id:'platform',...data},update:data});
 });
}
