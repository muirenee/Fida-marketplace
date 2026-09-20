import type { FastifyInstance } from 'fastify';
import { prisma } from '@fida/database/client';
import { authenticate, requirePlatformAdmin } from '../lib/auth.js';
import { merchantWriteRoles, requireTenant } from '../lib/tenant.js';
const txt = (v: unknown, n = 2000) => typeof v === 'string' ? v.trim().slice(0,n) : '';
export async function growthRoutes(app: FastifyInstance) {
 app.get('/v1/customer/favorites', { preHandler: authenticate }, async req => {
  const favorites = await prisma.favorite.findMany({ where: { userId: req.authUser!.id } });
  return prisma.tenant.findMany({ where: { id: { in: favorites.map(f => f.tenantId) }, status: 'ACTIVE' }, select: { id: true, name: true, slug: true, merchantType: true } });
 });
 app.put('/v1/customer/favorites/:tenantId', { preHandler: authenticate }, async (req,reply) => {
  const {tenantId} = req.params as {tenantId:string};
  if (!await prisma.tenant.findFirst({ where: { id: tenantId, status: 'ACTIVE' } })) return reply.code(404).send({error:'merchant_not_found'});
  return prisma.favorite.upsert({ where: { userId_tenantId: { userId: req.authUser!.id, tenantId } }, update:{},create:{ userId:req.authUser!.id,tenantId } });
 });
 app.delete('/v1/customer/favorites/:tenantId', { preHandler: authenticate }, async (req,reply) => {
  const {tenantId}=req.params as {tenantId:string};await prisma.favorite.deleteMany({where:{userId:req.authUser!.id,tenantId}});return reply.code(204).send();
 });
 app.post('/v1/customer/orders/:id/review', {preHandler:authenticate}, async(req,reply)=>{
  const {id}=req.params as {id:string};const b=(req.body??{}) as Record<string,unknown>;
  const order=await prisma.order.findFirst({where:{id,customerId:req.authUser!.id,status:'COMPLETED'}});
  if(!order)return reply.code(404).send({error:'completed_order_required'});
  const rating=Number(b.rating);if(!Number.isInteger(rating)||rating<1||rating>5)return reply.code(400).send({error:'invalid_rating'});
  return prisma.review.upsert({where:{orderId:id},update:{rating,comment:txt(b.comment,1000)},create:{orderId:id,customerId:req.authUser!.id,tenantId:order.tenantId,rating,comment:txt(b.comment,1000)}});
 });
 app.get('/v1/marketplace/merchants/:slug/reviews',async(req,reply)=>{
  const {slug}=req.params as {slug:string};const tenant=await prisma.tenant.findFirst({where:{slug,status:'ACTIVE'}});if(!tenant)return reply.code(404).send({error:'merchant_not_found'});
  return prisma.review.findMany({where:{tenantId:tenant.id},select:{id:true,rating:true,comment:true,createdAt:true},take:50,orderBy:{createdAt:'desc'}});
 });
 app.post('/v1/customer/orders/:id/support',{preHandler:authenticate},async(req,reply)=>{
  const {id}=req.params as {id:string};const b=(req.body??{}) as Record<string,unknown>;
  const order=await prisma.order.findFirst({where:{id,customerId:req.authUser!.id}});if(!order)return reply.code(404).send({error:'order_not_found'});
  if(!txt(b.subject)||!txt(b.description))return reply.code(400).send({error:'describe_issue'});
  if(await prisma.supportCase.count({where:{orderId:id,userId:req.authUser!.id,status:'OPEN'}})>=3)return reply.code(409).send({error:'existing_open_cases'});
  return prisma.supportCase.create({data:{orderId:id,tenantId:order.tenantId,userId:req.authUser!.id,subject:txt(b.subject,160),description:txt(b.description)}});
 });
 app.get('/v1/customer/support',{preHandler:authenticate},async req=>prisma.supportCase.findMany({where:{userId:req.authUser!.id},orderBy:{createdAt:'desc'},take:100}));
 app.get('/v1/merchant/support',{preHandler:requireTenant()},async req=>prisma.supportCase.findMany({where:{tenantId:req.tenantContext!.tenantId},orderBy:{createdAt:'desc'},take:100}));
 app.patch('/v1/merchant/support/:id',{preHandler:requireTenant(merchantWriteRoles)},async(req,reply)=>{
  const {id}=req.params as {id:string};const b=(req.body??{})as Record<string,unknown>;
  if(!txt(b.resolution))return reply.code(400).send({error:'resolution_required'});
  const r=await prisma.supportCase.updateMany({where:{id,tenantId:req.tenantContext!.tenantId},data:{status:'RESOLVED',resolution:txt(b.resolution)}});if(!r.count)return reply.code(404).send({error:'case_not_found'});return {resolved:true};
 });
 app.get('/v1/merchant/finance',{preHandler:requireTenant(['OWNER','ADMIN'])},async req=>prisma.financeEntry.findMany({where:{tenantId:req.tenantContext!.tenantId},orderBy:{createdAt:'desc'},take:500}));
 app.post('/v1/admin/finance/remittances',{preHandler:requirePlatformAdmin},async(req,reply)=>{
  const b=(req.body??{})as Record<string,unknown>;const amount=Number(b.amount),tenantId=txt(b.tenantId),reference=txt(b.reference,120);
  if(!tenantId||!reference||!Number.isFinite(amount)||amount<=0||amount>100000000)return reply.code(400).send({error:'invalid_remittance'});
  if(!await prisma.tenant.findUnique({where:{id:tenantId}}))return reply.code(404).send({error:'merchant_not_found'});
  return prisma.financeEntry.create({data:{tenantId,kind:'COMMISSION_REMITTANCE',amount,reference:`remittance:${reference}`,note:txt(b.note),actorId:req.authUser!.id}});
 });
}
