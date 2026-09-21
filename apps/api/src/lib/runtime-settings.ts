import {BlockList,isIP} from 'node:net';
import {prisma} from '@fida/database/client';
export const runtimeKeys=['PUBLIC_BASE_URL','CORS_ORIGIN','ADMIN_ALLOWED_IPS','MAINTENANCE_MODE','FEATURED_STORE_IDS','FEATURED_STORE_MODE','LEGACY_PUBLIC_ORIGINS'] as const;
export type RuntimeValues=Partial<Record<typeof runtimeKeys[number],string>>;
let cached:RuntimeValues={},until=0;
export async function runtimeSettings(force=false):Promise<RuntimeValues>{
 if(force||Date.now()>until){const row=await prisma.runtimeSettings.findUnique({where:{id:'platform'}});cached=(row?.values??{}) as RuntimeValues;until=Date.now()+5000;}
 return Object.fromEntries(runtimeKeys.map(key=>[key,cached[key]??process.env[key]??''])) as RuntimeValues;
}
export function allowedAdminIp(value:string,ip:string){
 if(!value.trim())return true;
 const list=new BlockList();
 for(const entry of value.split(',').map(v=>v.trim())){
  const [address,prefix]=entry.split('/'),version=isIP(address);if(!version)throw new Error('Invalid IP address or CIDR.');
  const family=version===4?'ipv4':'ipv6';
  if(prefix===undefined)list.addAddress(address,family);
  else{const n=Number(prefix);if(!/^\d+$/.test(prefix)||n<0||n>(version===4?32:128))throw new Error('Invalid CIDR prefix.');list.addSubnet(address,n,family);}
 }
 const address=ip.replace(/^::ffff:/,'');return list.check(address,isIP(address)===6?'ipv6':'ipv4');
}
export function validateRuntime(input:unknown,requestIp:string):RuntimeValues{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Settings object required.');
 const result:RuntimeValues={};
 for(const [key,value] of Object.entries(input)){
  if(!runtimeKeys.includes(key as any)||typeof value!=='string'||value.length>4000||/[\r\n\0]/.test(value))throw new Error(`Invalid setting: ${key}`);
  if(['PUBLIC_BASE_URL'].includes(key)&&value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw new Error('Access URLs must use HTTPS without credentials or query strings.');}
  if(['CORS_ORIGIN','LEGACY_PUBLIC_ORIGINS'].includes(key)&&value)for(const v of value.split(',')){const u=new URL(v.trim());if(u.protocol!=='https:'||u.origin!==v.trim())throw new Error('Use comma-separated HTTPS origins.');}
  if(key==='ADMIN_ALLOWED_IPS'&&!allowedAdminIp(value,requestIp))throw new Error('The allow-list must include your current API connection address.');
  if(key==='MAINTENANCE_MODE'&&!['','true','false'].includes(value))throw new Error('Maintenance must be true or false.');
  if(key==='FEATURED_STORE_MODE'&&!['','AUTO','MANUAL'].includes(value))throw new Error('Choose AUTO or MANUAL featured stores.');
  if(key==='FEATURED_STORE_IDS'&&value.split(',').some(v=>v&&!/^[a-zA-Z0-9_-]+$/.test(v.trim())))throw new Error('Use comma-separated store IDs.');
  result[key as keyof RuntimeValues]=value;
 }
 return result;
}
