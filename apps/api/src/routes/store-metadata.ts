import type {FastifyInstance} from 'fastify';
import {prisma} from '@fida/database/client';
import {requireTenant} from '../lib/tenant.js';
import {applicationStage} from '../lib/merchant-application.js';
export async function storeMetadataRoutes(app:FastifyInstance){
 app.get('/v1/merchant/store',{preHandler:requireTenant(['OWNER'])},async req=>prisma.tenant.findUniqueOrThrow({where:{id:req.tenantContext!.tenantId},select:{name:true,slug:true,legalName:true,taxId:true,merchantType:true,cuisineTags:true,logoUrl:true,coverUrl:true,timezone:true,currency:true,branches:true}}));
 app.patch('/v1/merchant/store',{preHandler:requireTenant(['OWNER'])},async(req,reply)=>{
  const b=(req.body??{}) as Record<string,any>,id=req.tenantContext!.tenantId;
  const old=await prisma.tenant.findUniqueOrThrow({where:{id}}),merged={...old,...b};
  if(Object.keys(b).some(k=>!['name','legalName','taxId','merchantType','cuisineTags','logoUrl','coverUrl','timezone'].includes(k)))return reply.code(400).send({error:'invalid_store_field'});
  const legal=applicationStage(0,merged),store=applicationStage(1,merged);
  for(const key of ['logoUrl','coverUrl'])if(b[key]&&b[key]!==old[key as 'logoUrl'|'coverUrl']&&!await prisma.mediaAsset.findFirst({where:{url:b[key],ownerId:req.authUser!.id}}))return reply.code(400).send({error:'upload_your_image_first'});
  // Public URLs remain stable after approval; only initial registration generates the slug.
  const {slug,...fields}=store;
  return prisma.tenant.update({where:{id},data:{...legal,...fields},select:{id:true,name:true,slug:true}});
 });
 app.patch('/v1/merchant/store/branches/:id',{preHandler:requireTenant(['OWNER'])},async(req,reply)=>{
  const {id}=req.params as {id:string},b=(req.body??{}) as Record<string,any>;
  if(Object.keys(b).some(k=>!['name','addressLine','city','latitude','longitude','isActive','pickupEnabled','deliveryEnabled','isAcceptingOrders'].includes(k)))return reply.code(400).send({error:'invalid_branch_field'});
  for(const key of ['latitude','longitude'])if(b[key]!==undefined&&(typeof b[key]!=='number'||!Number.isFinite(b[key])||Math.abs(b[key])>(key==='latitude'?90:180)))return reply.code(400).send({error:'invalid_coordinates'});
  for(const key of ['name','addressLine','city'])if(b[key]!==undefined&&(typeof b[key]!=='string'||!b[key].trim()||b[key].length>300))return reply.code(400).send({error:'invalid_branch_text'});
  for(const key of ['isActive','pickupEnabled','deliveryEnabled','isAcceptingOrders'])if(b[key]!==undefined&&typeof b[key]!=='boolean')return reply.code(400).send({error:'invalid_branch_flag'});
  const changed=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Branch" WHERE id=${id} FOR UPDATE`;
   if(b.isActive===false&&await tx.order.count({where:{branchId:id,tenantId:req.tenantContext!.tenantId,status:{notIn:['COMPLETED','CANCELLED','REJECTED']}}}))throw Object.assign(new Error('Complete active orders before suspending this branch.'),{statusCode:409});
   return tx.branch.updateMany({where:{id,tenantId:req.tenantContext!.tenantId},data:b});
  });
  return changed.count?{success:true}:reply.code(404).send({error:'branch_not_found'});
 });
}
