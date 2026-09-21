import {storePurgePlan,executeStorePurge} from '../lib/store-purge.js';
import {saveRuntimeSettings} from '../lib/public-config.js';
import {catalog} from '../generated/admin-catalog.js';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import {Prisma,prisma} from '@fida/database/client';
import {randomBytes,createHash} from 'node:crypto';
import {requirePlatformAdmin} from '../lib/auth.js';
import {verifyPassword} from '../lib/security.js';
import {runtimeSettings,validateRuntime} from '../lib/runtime-settings.js';
import {models,modelInfo,delegate,keys,recordKey,checkKey,safeRow,cascadePlan,planHash,lockData,preserved,resetCounts} from '../lib/admin-data.js';
const fail=(statusCode:number,message:string):never=>{throw Object.assign(new Error(message),{statusCode});};
async function confirmPassword(req:FastifyRequest){const b=req.body as any;const user=await prisma.user.findUniqueOrThrow({where:{id:req.authUser!.id}});if(typeof b?.password!=='string'||b.password.length>128||!user.passwordHash||!await verifyPassword(b.password,user.passwordHash))return fail(403,'Current administrator password required.');}
async function protectAdmins(tx:any,nodes:any[],actorId:string){const ids=nodes.filter(n=>n.model==='User').map(n=>n.key.id);if(ids.includes(actorId))return fail(409,'You cannot delete your signed-in administrator.');if(!await tx.user.count({where:{isActive:true,isPlatformAdmin:true,id:{notIn:ids}}}))return fail(409,'An active platform administrator must remain.');}
export async function adminSystemRoutes(app:FastifyInstance){
 app.get('/v1/admin/system/stores',{preHandler:requirePlatformAdmin},async req=>{const q=req.query as {q?:string;ids?:string};const ids=(q.ids||'').split(',').filter(Boolean).slice(0,12);return prisma.tenant.findMany({where:{status:'ACTIVE',...(ids.length?{id:{in:ids}}:{name:{contains:String(q.q||'').slice(0,100),mode:'insensitive'}})},select:{id:true,name:true,slug:true},orderBy:[{name:'asc'},{id:'asc'}],take:30});});
 app.get('/v1/admin/system/settings',{preHandler:requirePlatformAdmin},async req=>({values:await runtimeSettings(true),connectionIp:req.ip}));
 app.patch('/v1/admin/system/settings',{preHandler:requirePlatformAdmin},async req=>{
  await confirmPassword(req);const b=req.body as any;let values;try{values=validateRuntime(b.values,req.ip);}catch(e){return fail(400,(e as Error).message);}
  if(values.FEATURED_STORE_IDS!==undefined){const ids=[...new Set(values.FEATURED_STORE_IDS.split(',').map(v=>v.trim()).filter(Boolean))];if(ids.length>12||await prisma.tenant.count({where:{id:{in:ids},status:'ACTIVE'}})!==ids.length)return fail(400,'Choose at most 12 active stores.');values.FEATURED_STORE_IDS=ids.join(',');}
  const normalizedRecords=await saveRuntimeSettings(values);return {values:await runtimeSettings(true),normalizedRecords};
 });
 app.get('/v1/admin/system/collections',{preHandler:requirePlatformAdmin},async()=>models.map(m=>({name:m.name,keys:keys(m.name),fields:m.fields.filter(f=>f.kind!=='object'&&!/(password|secret|tokenHash|deliveryPin)/i.test(f.name)).map(f=>({name:f.name,type:f.type,nullable:!f.isRequired,list:f.isList,enumValues:catalog.enums.find(e=>e.name===f.type)?.values.map(v=>v.name),readOnly:f.isId||!!m.primaryKey?.fields.includes(f.name)||['createdAt','updatedAt'].includes(f.name)}))})));
 app.get('/v1/admin/system/data/:model',{preHandler:requirePlatformAdmin},async req=>{
  const {model}=req.params as {model:string};modelInfo(model);const q=req.query as any,skip=Math.max(0,Math.min(100000,Number(q.offset)||0));
  const [rows,count]=await Promise.all([delegate(prisma,model).findMany({skip,take:50,orderBy:keys(model).map(k=>({[k]:'asc'}))}),delegate(prisma,model).count()]);return {rows:rows.map(safeRow),count};
 });
 app.patch('/v1/admin/system/data/:model',{preHandler:requirePlatformAdmin},async req=>{
  await confirmPassword(req);const {model}=req.params as {model:string};const info=modelInfo(model),b=req.body as any,key=checkKey(model,b.key);
  if(['RuntimeSettings','AdminAction'].includes(model))return fail(400,'Use the protected system settings/action interface.');
  if(typeof b.reason!=='string'||b.reason.trim().length<5)return fail(400,'An audit reason is required.');
  if(!b.changes||typeof b.changes!=='object'||Array.isArray(b.changes)||Object.keys(b.changes).length===0)return fail(400,'Changes required.');
  const changes:Record<string,any>={};
  for(const [k,v] of Object.entries(b.changes)){
   const field=info.fields.find(f=>f.name===k);
   if(!field||field.kind==='object'||keys(model).includes(k)||/(password|secret|tokenHash|deliveryPin)/i.test(k)||['createdAt','updatedAt'].includes(k))return fail(400,`Cannot edit field ${k}.`);
   if(v===null){if(field.isRequired&&field.type!=='Json')return fail(400,`${k} cannot be empty.`);changes[k]=field.type==='Json'?(field.isRequired?Prisma.JsonNull:Prisma.DbNull):null;continue;}
   const values=field.isList?(Array.isArray(v)?v:fail(400,`${k} must be an array.`)):[v];
   for(const value of values){
    if(field.kind==='enum'&&!catalog.enums.find(e=>e.name===field.type)?.values.some(e=>e.name===value))return fail(400,`Invalid ${k} value.`);
    if(field.type==='String'&&typeof value!=='string'||field.type==='Boolean'&&typeof value!=='boolean')return fail(400,`Invalid ${k} type.`);
    if(['Int','Float'].includes(field.type)&&(typeof value!=='number'||!Number.isFinite(value)||(field.type==='Int'&&!Number.isSafeInteger(value))))return fail(400,`Invalid ${k} number.`);
    if(field.type==='Decimal'){try{if(!new Prisma.Decimal(value as any).isFinite())return fail(400,`Invalid ${k} amount.`);}catch{return fail(400,`Invalid ${k} amount.`);}}
    if(field.type==='DateTime'&&(typeof value!=='string'||!Number.isFinite(Date.parse(value))))return fail(400,`Invalid ${k} date.`);
   }
   changes[k]=field.type==='DateTime'?new Date(v as string):v;
  }
  return prisma.$transaction(async tx=>{
   await lockData(tx);
   if(model==='User'&&(changes.isActive===false||changes.isPlatformAdmin===false)){if(key.id===req.authUser!.id)return fail(409,'Cannot remove your own administrator access.');if(!await tx.user.count({where:{isActive:true,isPlatformAdmin:true,id:{not:key.id}}}))return fail(409,'An active platform administrator must remain.');}
   const changed=await delegate(tx,model).updateMany({where:key,data:changes});if(!changed.count)return fail(404,'Record not found.');return safeRow(await delegate(tx,model).findFirst({where:key}));
  });
 });
 app.post('/v1/admin/system/actions/preview',{preHandler:requirePlatformAdmin},async req=>{
  await confirmPassword(req);const b=req.body as any;if(typeof b.reason!=='string'||b.reason.trim().length<5)return fail(400,'An audit reason is required.');
  if(!['RESET','DELETE'].includes(b.kind))return fail(400,'Invalid action.');
  if(b.kind==='DELETE'&&['AdminAction','RuntimeSettings'].includes(b.model))return fail(400,'Use the dedicated system controls.');
  const key=b.kind==='DELETE'?checkKey(b.model,b.key):null;
  const plan=b.kind==='DELETE'?(b.model==='Tenant'?await storePurgePlan(prisma,key!.id):await cascadePlan(prisma,b.model,key)):await resetCounts(prisma);
  if(Array.isArray(plan)){if(!plan.length)return fail(404,'Record not found.');await protectAdmins(prisma,plan,req.authUser!.id);}
  const token=randomBytes(32).toString('base64url'),payload={kind:b.kind,model:b.kind==='DELETE'?b.model:null,key,hash:planHash(plan),reason:b.reason};
  await prisma.adminAction.create({data:{actorId:req.authUser!.id,tokenHash:createHash('sha256').update(token).digest('hex'),payload,expiresAt:new Date(Date.now()+300000)}});
  const counts='kind' in plan&&plan.kind==='STORE_PURGE'?Object.fromEntries((plan as any).rows.map((r:any)=>[r.model==='User'?'Credentials revoked':r.model,r.count])):Array.isArray(plan)?plan.reduce((v:Record<string,number>,n)=>({...v,[n.model]:(v[n.model]??0)+1}),{}):plan;
  return {token,counts,confirmation:b.kind==='RESET'?'RESET OPERATIONAL DATA':`DELETE ${b.model}`,expiresInSeconds:300,preserved:b.kind==='RESET'?['Platform administrators','Admin sessions','Runtime settings','Audit history','Media files on disk']:[]};
 });
 app.post('/v1/admin/system/actions/execute',{preHandler:requirePlatformAdmin},async req=>{
  await confirmPassword(req);const b=req.body as any;if(typeof b.token!=='string')return fail(400,'Preview token required.');
  return prisma.$transaction(async tx=>{
   await lockData(tx);
   const action=await tx.adminAction.findUnique({where:{tokenHash:createHash('sha256').update(b.token).digest('hex')}});
   if(!action||action.actorId!==req.authUser!.id||action.usedAt||action.expiresAt<new Date())return fail(409,'Preview expired or already used.');
   const p=action.payload as any,confirmation=p.kind==='RESET'?'RESET OPERATIONAL DATA':`DELETE ${p.model}`;
   if(b.confirmation!==confirmation)return fail(400,'Confirmation text does not match.');
   const plan=p.kind==='RESET'?await resetCounts(tx):p.model==='Tenant'?await storePurgePlan(tx,p.key.id):await cascadePlan(tx,p.model,p.key);
   if(planHash(plan)!==p.hash)return fail(409,'Data changed after preview; generate another preview.');
   if(p.kind==='RESET'){
    const tables=models.filter(m=>!preserved.includes(m.name)).map(m=>`"${m.dbName??m.name}"`).join(',');
    await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tables}`);
    await tx.user.deleteMany({where:{isPlatformAdmin:false}});
   }else if(p.model==='Tenant'){await executeStorePurge(tx,p.key.id);
   }else{await protectAdmins(tx,plan as any[],req.authUser!.id);for(const node of plan as any[])await delegate(tx,node.model).deleteMany({where:node.key});}
   await tx.adminAction.update({where:{id:action.id},data:{usedAt:new Date()}});
   await tx.adminAuditEvent.create({data:{actorUserId:req.authUser!.id,actorEmail:req.authUser!.email,action:p.kind==='RESET'?'OPERATIONAL_RESET':'CASCADE_DELETE',method:'POST',route:'/v1/admin/system/actions/execute',path:req.url,statusCode:200,success:true,changes:{reason:p.reason,plan} as Prisma.InputJsonValue}});
   return {success:true};
  },{timeout:60000});
 });
}
