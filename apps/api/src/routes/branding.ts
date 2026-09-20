import type {FastifyInstance,FastifyRequest} from 'fastify';
import {createWriteStream} from 'node:fs';
import {mkdir,readFile,unlink,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import sharp from 'sharp';
import {prisma} from '@fida/database/client';
import {authenticate} from '../lib/auth.js';
const limit=5*1024*1024;
export async function brandingRoutes(app:FastifyInstance){
 const uploads=new WeakMap<FastifyRequest,{path:string;size:number}>();
 app.addContentTypeParser(['image/jpeg','image/png','image/webp'],async(req:FastifyRequest,payload:NodeJS.ReadableStream)=>{
  if(Number(req.headers['content-length'])>limit)throw Object.assign(new Error('Maximum image size is 5 MB.'),{statusCode:413});
  const directory=resolve(process.env.MEDIA_DIRECTORY??'./uploads',`.incoming`);
  await mkdir(directory,{recursive:true});const path=resolve(directory,randomUUID());let size=0;
  const counter=new Transform({transform(chunk,_encoding,done){size+=chunk.length;done(size>limit?Object.assign(new Error('Maximum image size is 5 MB.'),{statusCode:413}):null,chunk);}});
  const onError=(error:Error)=>counter.destroy(error);
  const onAbort=()=>counter.destroy(new Error('Upload aborted.'));
  payload.once('error',onError);req.raw.once('aborted',onAbort);
  try{
   // Keep pipeline error teardown away from the HTTP socket so a 413 can be sent.
   const writing=pipeline(counter,createWriteStream(path,{flags:'wx',mode:0o600}));
   payload.pipe(counter);
   await writing;
   uploads.set(req,{path,size});
   return {};
  }catch(e){payload.unpipe(counter);payload.resume();await unlink(path).catch(()=>{});throw e;}
  finally{payload.removeListener('error',onError);req.raw.removeListener('aborted',onAbort);}
 });
 app.post('/v1/merchant/branding',{onRequest:authenticate,bodyLimit:limit},async(req,reply)=>{
  const body=uploads.get(req);
  if(!body?.path)return reply.code(400).send({error:'binary_image_required'});
  const ownerId=req.authUser!.id,folder=`branding_${ownerId}`;
  const directory=resolve(process.env.MEDIA_DIRECTORY??'./uploads',folder);
  const filename=`${randomUUID()}.webp`,destination=resolve(directory,filename);
  try{
   const bytes=await readFile(body.path);
   const valid=bytes.subarray(0,3).equals(Buffer.from([255,216,255]))||bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP');
   if(!valid)throw new Error('Choose a valid JPEG, PNG or WebP image.');
   await mkdir(directory,{recursive:true});
   await sharp(body.path,{limitInputPixels:16000000,failOn:'warning'}).rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toFile(destination);
   const url=`/v1/media/${folder}/${filename}`;
   const asset=await prisma.mediaAsset.create({data:{ownerId,url,bytes:(await stat(destination)).size}});
   return reply.code(201).send({url:asset.url,bytes:asset.bytes});
  }catch(e){await unlink(destination).catch(()=>{});return reply.code(400).send({error:'invalid_image',message:'Upload a valid JPEG, PNG or WebP up to 5 MB and 16 megapixels.'});}
  finally{uploads.delete(req);await unlink(body.path).catch(()=>{});}
 });
}
