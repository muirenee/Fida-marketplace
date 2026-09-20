import type {FastifyInstance} from 'fastify';
import {Prisma,prisma} from '@fida/database/client';
import {requirePlatformAdmin} from '../lib/auth.js';
import {createHash} from 'node:crypto';
const bad=(message:string):never=>{throw Object.assign(new Error(message),{statusCode:400});};
export async function commissionPeriodRoutes(app:FastifyInstance){
 app.get('/v1/admin/commission-periods',{preHandler:requirePlatformAdmin},async()=>({tenants:await prisma.tenant.findMany({select:{id:true,name:true,currency:true},orderBy:{name:'asc'}}),invoices:await prisma.commissionPeriod.findMany({orderBy:{createdAt:'desc'},take:200})}));
 app.post('/v1/admin/commission-periods',{preHandler:requirePlatformAdmin},async req=>{
  const b=req.body as any;
  for(const key of ['from','to'])if(typeof b?.[key]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b[key])||!Number.isFinite(Date.parse(b[key]))||new Date(b[key]).toISOString().slice(0,10)!==b[key])return bad('Choose valid start and end dates.');
  const from=new Date(`${b.from}T00:00:00Z`),until=new Date(Date.parse(`${b.to}T00:00:00Z`)+86400000);
  if(until<=from||until.getTime()-from.getTime()>366*86400000)return bad('Choose a period of at most 366 days.');
  if(typeof b.tenantId!=='string')return bad('Choose a merchant.');
  return prisma.$transaction(async tx=>{
   const tenant=await tx.tenant.findUnique({where:{id:b.tenantId}});if(!tenant)return bad('Merchant not found.');
   await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id=${tenant.id} FOR UPDATE`;
   const existing=await tx.commissionPeriod.findUnique({where:{tenantId_from_until:{tenantId:tenant.id,from,until}}});if(existing)return existing;
   const documents=await tx.businessDocument.findMany({where:{tenantId:tenant.id,kind:{in:['COMMISSION_INVOICE','COMMISSION_CREDIT']},issuedAt:{gte:from,lt:until}},orderBy:[{issuedAt:'asc'},{id:'asc'}],take:10001});
   if(documents.length>10000)return bad('Choose a smaller date range.');if(!documents.length)return bad('No commission documents exist in this period.');
   const currencies=new Set(documents.map(d=>(d.payload as any).currency));
   if(currencies.size!==1||typeof [...currencies][0]!=='string')return bad('This period contains different currencies; select a smaller range.');
   const currency=[...currencies][0] as string;
   const lines=documents.map(d=>({description:`${d.number} · ${d.orderId}`,quantity:1,amount:String((d.payload as any).total),unitPrice:String((d.payload as any).total)}));
   const total=lines.reduce((sum,line)=>sum.plus(line.amount),new Prisma.Decimal(0)).toFixed(2);
   const number=`PER-${createHash('sha256').update(`${tenant.id}:${b.from}:${b.to}`).digest('hex').slice(0,20).toUpperCase()}`;
   const payload={title:'Consolidated commission invoice',issuer:'Fidalix Ltd',recipient:tenant.legalName||tenant.name,currency,issuedAt:new Date().toISOString(),periodFrom:b.from,periodTo:b.to,orderNumber:`Period ${b.from} – ${b.to} (UTC)`,lines,subtotal:total,total,documentIds:documents.map(d=>d.id),note:'Consolidates the listed invoices and credit notes; this is not an additional commission charge. Remittances are recorded separately.'};
   return tx.commissionPeriod.create({data:{tenantId:tenant.id,from,until,number,payload,createdBy:req.authUser!.id}});
  });
 });
}
