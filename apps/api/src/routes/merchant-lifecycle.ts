import type { FastifyInstance } from 'fastify';
import { prisma } from '@fida/database/client';
import { authenticate, requirePlatformAdmin } from '../lib/auth.js';
import { requireTenant } from '../lib/tenant.js';
import { hashPassword } from '../lib/security.js';
import { applicationStage, fullApplication, createPendingTenant } from '../lib/merchant-application.js';
const fail = (statusCode: number, message: string): never => { throw Object.assign(new Error(message), {statusCode}); };
const staffSelect = {id:true,role:true,isActive:true,branchId:true,user:{select:{id:true,email:true,firstName:true,lastName:true}}} as const;
export async function merchantLifecycleRoutes(app: FastifyInstance) {
  app.get('/v1/merchant/applications',{preHandler:authenticate},async req=>prisma.merchantApplication.findMany({where:{ownerId:req.authUser!.id},orderBy:{createdAt:'desc'},take:20}));
  app.post('/v1/merchant/applications',{preHandler:authenticate},async(req,reply)=>{
    const row=await prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${req.authUser!.id} FOR UPDATE`;
      if(await tx.merchantApplication.count({where:{ownerId:req.authUser!.id,status:{in:['DRAFT','SUBMITTED']}}})) return fail(409,'Continue your existing application.');
      return tx.merchantApplication.create({data:{ownerId:req.authUser!.id,payload:{}}});
    });return reply.code(201).send(row);
  });
  app.patch('/v1/merchant/applications/:id',{preHandler:authenticate},async(req)=>{
    const {id}=req.params as {id:string};const body=req.body as {stage:number;data:unknown};
    const fields=applicationStage(body?.stage,body?.data);
    return prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "MerchantApplication" WHERE id=${id} FOR UPDATE`;
      const row=await tx.merchantApplication.findFirst({where:{id,ownerId:req.authUser!.id,status:'DRAFT'}});
      if(!row) return fail(404,'Editable application not found.');
      if(body.stage>row.step) return fail(409,'Complete the previous step first.');
      return tx.merchantApplication.update({where:{id},data:{payload:{...(row.payload as object),...fields},step:Math.max(row.step,body.stage+1)}});
    });
  });
  app.post('/v1/merchant/applications/:id/reopen',{preHandler:authenticate},async req=>{
    const {id}=req.params as {id:string};
    return prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${req.authUser!.id} FOR UPDATE`;
      if(await tx.merchantApplication.count({where:{ownerId:req.authUser!.id,status:{in:['DRAFT','SUBMITTED']}}}))return fail(409,'Continue your existing application.');
      const changed=await tx.merchantApplication.updateMany({where:{id,ownerId:req.authUser!.id,status:'REJECTED'},data:{status:'DRAFT',step:0}});
      if(!changed.count)return fail(409,'Only your rejected application can be reopened.');
      return tx.merchantApplication.findUniqueOrThrow({where:{id}});
    });
  });
  app.post('/v1/merchant/applications/:id/submit',{preHandler:authenticate},async(req)=>{
    const {id}=req.params as {id:string};
    return prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "MerchantApplication" WHERE id=${id} FOR UPDATE`;
      const row=await tx.merchantApplication.findFirst({where:{id,ownerId:req.authUser!.id}});
      if(!row) return fail(404,'Application not found.');
      if(row.status!=='DRAFT') return row;
      const b=fullApplication(row.payload);
      if(await tx.tenant.findFirst({where:{slug:b.slug,...(row.tenantId?{id:{not:row.tenantId}}:{})}})) return fail(409,'Store URL is already in use.');
      const tenant=await createPendingTenant(tx,req.authUser!.id,b,row.tenantId??undefined);
      return tx.merchantApplication.update({where:{id},data:{status:'SUBMITTED',tenantId:tenant.id}});
    });
  });
  app.get('/v1/admin/merchant-applications',{preHandler:requirePlatformAdmin},async()=>prisma.merchantApplication.findMany({where:{status:{not:'DRAFT'}},orderBy:{createdAt:'desc'},take:200}));
  app.post('/v1/admin/merchant-applications/:id/review',{preHandler:requirePlatformAdmin},async req=>{
    const {id}=req.params as {id:string};const b=req.body as {action:string;reason?:string};
    if(!['APPROVE','REJECT'].includes(b?.action)||!b.reason?.trim()||b.reason.length>2000)return fail(400,'Choose approve/reject and provide a review note.');
    return prisma.$transaction(async tx=>{
      const changed=await tx.merchantApplication.updateMany({where:{id,status:'SUBMITTED'},data:{status:b.action==='APPROVE'?'APPROVED':'REJECTED',reviewedBy:req.authUser!.id,reviewedAt:new Date(),reviewReason:b.reason!.trim()}});
      if(!changed.count)return fail(409,'Application already reviewed or unavailable.');
      const row=await tx.merchantApplication.findUniqueOrThrow({where:{id}});
      await tx.tenant.update({where:{id:row.tenantId!},data:{status:b.action==='APPROVE'?'ACTIVE':'REJECTED',isAcceptingOrders:b.action==='APPROVE',activatedAt:b.action==='APPROVE'?new Date():null}});
      return row;
    });
  });
  app.get('/v1/merchant/staff',{preHandler:requireTenant(['OWNER'])},async req=>prisma.tenantMembership.findMany({where:{tenantId:req.tenantContext!.tenantId},select:staffSelect,orderBy:{createdAt:'asc'}}));
  app.post('/v1/merchant/staff',{preHandler:requireTenant(['OWNER'])},async(req,reply)=>{
    const b=(req.body??{}) as Record<string,unknown>,email=typeof b.email==='string'?b.email.trim().toLowerCase():'';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof b.password!=='string'||b.password.length<12||b.password.length>128||!['MANAGER','KITCHEN_CREW'].includes(String(b.role)))return fail(400,'Valid email, a 12–128 character password and staff role are required.');
    const branchId=typeof b.branchId==='string'&&b.branchId?b.branchId:null,tenantId=req.tenantContext!.tenantId;
    if(branchId&&!await prisma.branch.findFirst({where:{id:branchId,tenantId,isActive:true}}))return fail(400,'Invalid branch.');
    const passwordHash=await hashPassword(b.password);
    const result=await prisma.$transaction(async tx=>{
      if(await tx.user.findUnique({where:{email}}))return fail(409,'This email already has an account. Use a new staff email.');
      const user=await tx.user.create({data:{email,passwordHash,firstName:typeof b.firstName==='string'?b.firstName.trim().slice(0,80):null}});
      return tx.tenantMembership.create({data:{userId:user.id,tenantId,branchId,role:b.role as 'MANAGER'|'KITCHEN_CREW'},select:staffSelect});
    });return reply.code(201).send(result);
  });
  app.patch('/v1/merchant/staff/:id',{preHandler:requireTenant(['OWNER'])},async req=>{
    const {id}=req.params as {id:string};const b=req.body as {role?:'MANAGER'|'KITCHEN_CREW';isActive?:boolean};
    if(!b||Object.keys(b).some(k=>!['role','isActive'].includes(k))||(b.role!==undefined&&!['MANAGER','KITCHEN_CREW'].includes(b.role))||(b.isActive!==undefined&&typeof b.isActive!=='boolean'))return fail(400,'Invalid staff update.');
    const changed=await prisma.tenantMembership.updateMany({where:{id,tenantId:req.tenantContext!.tenantId,role:{in:['MANAGER','KITCHEN_CREW','STAFF']}},data:b});
    if(!changed.count)return fail(404,'Staff membership not found.');
    return prisma.tenantMembership.findUnique({where:{id},select:staffSelect});
  });
  app.patch('/v1/merchant/products/:id/stock',{preHandler:requireTenant(['OWNER','ADMIN','MANAGER','KITCHEN_CREW'])},async req=>{
    const {id}=req.params as {id:string};const b=req.body as {isAvailable:boolean};
    if(!b||typeof b.isAvailable!=='boolean'||Object.keys(b).some(k=>k!=='isAvailable'))return fail(400,'Provide only isAvailable.');
    const changed=await prisma.product.updateMany({where:{id,tenantId:req.tenantContext!.tenantId,deletedAt:null},data:{isAvailable:b.isAvailable}});
    if(!changed.count)return fail(404,'Product not found.');return {id,isAvailable:b.isAvailable};
  });
}
