import {Prisma,prisma} from '@fida/database/client';
import {runtimeSettings} from './runtime-settings.js';
type DB=Prisma.TransactionClient;
export function mediaPath(value:unknown,origins:Set<string>):unknown{
 if(typeof value!=='string'||!value.startsWith('https://'))return value;
 try{const u=new URL(value);if(origins.has(u.origin)&&/^\/v1\/media\/[A-Za-z0-9_-]+\/[a-f0-9-]{36}\.(webp|png|jpg)$/.test(u.pathname)&&!u.search&&!u.hash)return u.pathname;}catch{}
 return value;
}
export async function normalizeMediaUrls(db:DB,origins:Set<string>){
 let changed=0;
 for(const model of ['tenant','product','mediaAsset','merchantApplication'] as const){
  const fields=model==='tenant'?['logoUrl','coverUrl']:model==='product'?['imageUrl']:model==='mediaAsset'?['url']:[];
  let cursor:string|undefined;
  for(;;){
   const rows=await (db[model] as any).findMany({take:250,orderBy:{id:'asc'},...(cursor?{cursor:{id:cursor},skip:1}:{})});
   if(!rows.length)break;
   for(const row of rows){
    const data:Record<string,any>={};
    for(const key of fields){const next=mediaPath(row[key],origins);if(next!==row[key])data[key]=next;}
    if(model==='merchantApplication'&&row.payload&&typeof row.payload==='object'){
     const payload={...row.payload};let touched=false;
     for(const key of ['logoUrl','coverUrl']){const next=mediaPath(payload[key],origins);if(next!==payload[key]){payload[key]=next;touched=true;}}
     if(touched)data.payload=payload;
    }
    if(Object.keys(data).length){
     if(model==='mediaAsset'&&await db.mediaAsset.findFirst({where:{url:data.url,id:{not:row.id}}}))throw Object.assign(new Error('Conflicting media paths; resolve the duplicate asset before changing URLs.'),{statusCode:409});
     await (db[model] as any).update({where:{id:row.id},data});changed++;
    }
   }
   cursor=rows.at(-1)!.id;
  }
 }
 return changed;
}
export async function saveRuntimeSettings(values:Record<string,string>){
 const result=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(9011001)::text`;
  const row=await tx.runtimeSettings.findUnique({where:{id:'platform'}});
  const old=(row?.values??{}) as Record<string,any>;
  const merged={...old,...values};
  const origins=new Set<string>();
  for(const url of [old.PUBLIC_BASE_URL,process.env.PUBLIC_BASE_URL,merged.PUBLIC_BASE_URL,...String(merged.LEGACY_PUBLIC_ORIGINS??process.env.LEGACY_PUBLIC_ORIGINS??'').split(',')]){
   if(url)try{origins.add(new URL(url).origin);}catch{}
  }
  merged.LEGACY_PUBLIC_ORIGINS=[...origins].sort().join(',');
  const normalized=await normalizeMediaUrls(tx,origins);
  await tx.runtimeSettings.upsert({where:{id:'platform'},create:{values:merged},update:{values:merged}});
  return normalized;
 },{timeout:60000});
 await runtimeSettings(true);return result;
}
export async function publicConfiguration(){
 const s=await runtimeSettings();
 const publicBaseUrl=s.PUBLIC_BASE_URL||null;
 return {schemaVersion:1,publicBaseUrl,apiBaseUrl:publicBaseUrl,merchantPath:'/merchant',mediaPath:'/v1/media/',legacyOrigins:(s.LEGACY_PUBLIC_ORIGINS||'').split(',').filter(Boolean),allowedOrigins:[...new Set([...(s.CORS_ORIGIN||'').split(',').map(v=>v.trim()).filter(Boolean),...(publicBaseUrl?[new URL(publicBaseUrl).origin]:[])])]};
}

export function relativeMediaFields(value:any,origins:Set<string>):any{
 if(Array.isArray(value))return value.map(v=>relativeMediaFields(v,origins));
 if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)return value;
 return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,['logoUrl','coverUrl','imageUrl','url'].includes(key)?mediaPath(v,origins):relativeMediaFields(v,origins)]));
}
