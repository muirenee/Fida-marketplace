import type {FastifyInstance} from 'fastify';
import {prisma} from '@fida/database/client';
import {authenticate,requirePlatformAdmin} from '../lib/auth.js';
const fail=(message:string):never=>{throw Object.assign(new Error(message),{statusCode:400});};
export async function storeCategoryRoutes(app:FastifyInstance){
 const active=()=>prisma.storeCategory.findMany({where:{isActive:true},orderBy:[{sortOrder:'asc'},{name:'asc'}]});
 app.get('/v1/merchant/store-categories',{preHandler:authenticate},active);
 app.get('/v1/marketplace/store-categories',active);
 app.get('/v1/admin/store-categories',{preHandler:requirePlatformAdmin},async()=>prisma.storeCategory.findMany({include:{_count:{select:{stores:true}}},orderBy:[{sortOrder:'asc'},{name:'asc'}]}));
 app.post('/v1/admin/store-categories',{preHandler:requirePlatformAdmin},async(req,reply)=>{
  const b=req.body as any,data=fields(b),code=typeof b?.code==='string'?b.code.trim().toUpperCase():'';
  if(!/^[A-Z][A-Z0-9_]{1,49}$/.test(code))return fail('Use a unique category code of 2–50 letters, digits or underscores.');
  if(await prisma.storeCategory.findUnique({where:{code}}))return reply.code(409).send({error:'category_code_in_use'});
  return reply.code(201).send(await prisma.storeCategory.create({data:{code,...data}}));
 });
 app.patch('/v1/admin/store-categories/:code',{preHandler:requirePlatformAdmin},async(req,reply)=>{
  const {code}=req.params as {code:string},data=fields(req.body);
  const row=await prisma.storeCategory.updateMany({where:{code},data});return row.count?{success:true}:reply.code(404).send({error:'category_not_found'});
 });
 app.delete('/v1/admin/store-categories/:code',{preHandler:requirePlatformAdmin},async(req,reply)=>{
  const {code}=req.params as {code:string};
  // FK SET NULL preserves stores and menus when a category is removed.
  const row=await prisma.storeCategory.deleteMany({where:{code}});return row.count?{success:true}:reply.code(404).send({error:'category_not_found'});
 });
}
function fields(raw:unknown){
 const b=raw as any;if(!b||typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>80||typeof b.icon!=='string'||!b.icon.trim()||[...b.icon].length>12||typeof b.isActive!=='boolean'||!Number.isInteger(b.sortOrder)||b.sortOrder<0||b.sortOrder>10000)fail('Provide category name, icon, active flag and sort order (0–10000).');
 return {name:b.name.trim(),icon:b.icon.trim(),isActive:b.isActive,sortOrder:b.sortOrder};
}
