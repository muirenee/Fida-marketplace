import {Prisma,prisma} from '@fida/database/client';
import {createHash} from 'node:crypto';
import {catalog} from '../generated/admin-catalog.js';
export const models=catalog.models;
export const modelInfo=(name:string)=>{const m=models.find(m=>m.name===name);if(!m)throw Object.assign(new Error('Unknown collection.'),{statusCode:404});return m;};
export const delegate=(db:any,name:string)=>db[name[0].toLowerCase()+name.slice(1)];
export const keys=(name:string)=>{const m=modelInfo(name);return m.primaryKey?.fields??m.fields.filter(f=>f.isId).map(f=>f.name);};
export function recordKey(name:string,row:any){return Object.fromEntries(keys(name).map(k=>[k,row[k]]));}
export function checkKey(name:string,key:any){const names=keys(name);if(!key||Object.keys(key).length!==names.length||names.some(k=>typeof key[k]!=='string'))throw Object.assign(new Error('Complete primary key required.'),{statusCode:400});return key;}
export function safeRow(row:any){return JSON.parse(JSON.stringify(row,(key,value)=>/(password|secret|tokenHash|deliveryPin)/i.test(key)?undefined:value));}
const logical:Record<string,string>={tenantId:'Tenant',ownerId:'User',userId:'User',customerId:'User',actorId:'User',createdBy:'User',orderId:'Order',productId:'Product',branchId:'Branch',driverId:'Driver',operatorId:'DeliveryOperator'};
export async function cascadePlan(db:any,name:string,key:any){
 const nodes:{model:string;key:any;fingerprint:string}[]=[],seen=new Set<string>();
 async function visit(model:string,where:any){
  const row=await delegate(db,model).findFirst({where});if(!row)return;
  const key=recordKey(model,row),identity=model+JSON.stringify(key);if(seen.has(identity))return;seen.add(identity);
  if(seen.size>5000)throw Object.assign(new Error('Cascade exceeds 5,000 records. Use a reviewed maintenance reset or smaller batches.'),{statusCode:413});
  for(const child of models){
   if(['AdminAuditEvent','AdminAction'].includes(child.name))continue;
   const conditions:any[]=[];
   for(const f of child.fields){
    if(f.kind==='object'&&f.type===model&&f.relationFromFields?.length)conditions.push(Object.fromEntries(f.relationFromFields.map((v,i)=>[v,row[f.relationToFields![i]]])));
    else if(f.kind==='scalar'&&logical[f.name]===model&&row.id)conditions.push({[f.name]:row.id});
   }
   if(conditions.length){const rows=await delegate(db,child.name).findMany({where:{OR:conditions},orderBy:keys(child.name).map(k=>({[k]:'asc'})),take:5001});if(rows.length>5000)throw Object.assign(new Error('Cascade too large.'),{statusCode:413});for(const record of rows)await visit(child.name,recordKey(child.name,record));}
  }
  nodes.push({model,key,fingerprint:createHash('sha256').update(JSON.stringify(row)).digest('hex')});
 }
 await visit(name,key);return nodes;
}
export const planHash=(plan:unknown)=>createHash('sha256').update(JSON.stringify(plan)).digest('hex');
export async function lockData(db:Prisma.TransactionClient){
 const tables=models.map(m=>`"${m.dbName??m.name}"`).sort().join(',');
 await db.$executeRawUnsafe(`LOCK TABLE ${tables} IN EXCLUSIVE MODE`);
}
export const preserved=['User','Session','RuntimeSettings','AdminAction','AdminAuditEvent'];
export async function resetCounts(db:any){const result:Record<string,number>={};for(const m of models){if(preserved.includes(m.name))continue;result[m.name]=await delegate(db,m.name).count();}result.User=await db.user.count({where:{isPlatformAdmin:false}});return result;}
