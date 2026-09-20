import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const schema=readFileSync('packages/database/prisma/schema.prisma','utf8');
if(/@map\s*\(/.test(schema))throw Error('Update the admin catalog generator for mapped table/column names before applying this schema.');
const enums=[...schema.matchAll(/enum\s+(\w+)\s*\{([^}]+)\}/g)].map(([,name,body])=>({name,values:body.trim().split(/\s+/).map(name=>({name}))}));
const blocks=[...schema.matchAll(/model\s+(\w+)\s*\{([^}]+)\}/g)],names=new Set(blocks.map(m=>m[1]));
const models=blocks.map(([,name,body])=>({name,dbName:null,primaryKey:body.match(/@@id\(\[([^\]]+)\]/)?{fields:body.match(/@@id\(\[([^\]]+)\]/)[1].split(',').map(v=>v.trim())}:null,fields:body.split('\n').map(line=>line.trim()).filter(line=>line&&!line.startsWith('//')&&!line.startsWith('@@')).map(line=>{
 const match=line.match(/^(\w+)\s+(\w+)(\?|\[\])?(.*)$/);if(!match)throw Error(`Unsupported schema field: ${line}`);
 const [,name,type,modifier,attributes]=match,from=attributes.match(/fields:\s*\[([^\]]+)\]/),to=attributes.match(/references:\s*\[([^\]]+)\]/);
 return {name,type,kind:names.has(type)?'object':enums.some(e=>e.name===type)?'enum':'scalar',isId:/@id\b/.test(attributes),isRequired:modifier!=='?',isList:modifier==='[]',relationFromFields:from?from[1].split(',').map(s=>s.trim()):[],relationToFields:to?to[1].split(',').map(s=>s.trim()):[]};
})}));
mkdirSync('apps/api/src/generated',{recursive:true});
writeFileSync('apps/api/src/generated/admin-catalog.ts',`// Generated from schema.prisma by scripts/generate-admin-catalog.mjs.\nexport type CatalogField={name:string;type:string;kind:string;isId:boolean;isRequired:boolean;isList:boolean;relationFromFields:string[];relationToFields:string[]};\nexport type CatalogModel={name:string;dbName:string|null;primaryKey:{fields:string[]}|null;fields:CatalogField[]};\nexport const catalog:{models:CatalogModel[];enums:{name:string;values:{name:string}[]}[]}=${JSON.stringify({models,enums},null,2)};\n`);
