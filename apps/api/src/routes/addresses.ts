import type { FastifyInstance } from 'fastify';
import { prisma } from '@fida/database/client';
import { authenticate } from '../lib/auth.js';

function coordinates(b:Record<string,unknown>){
 if(b.latitude==null&&b.longitude==null)return {latitude:null,longitude:null};
 if(typeof b.latitude!=='number'||typeof b.longitude!=='number'||!Number.isFinite(b.latitude)||!Number.isFinite(b.longitude)||Math.abs(b.latitude)>90||Math.abs(b.longitude)>180)throw Object.assign(new Error('Provide valid latitude and longitude together.'),{statusCode:400});
 return {latitude:b.latitude,longitude:b.longitude};
}
export async function addressRoutes(app: FastifyInstance) {
  app.get('/v1/customer/addresses', { preHandler: authenticate }, async (request) => {
    return prisma.customerAddress.findMany({
      where: { userId: request.authUser!.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  });

  app.post('/v1/customer/addresses', { preHandler: authenticate }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const addressLine = typeof body.addressLine === 'string' ? body.addressLine.trim() : '';
    const isDefault = body.isDefault === true;

    if (!addressLine || addressLine.length>500) {
      return reply.code(400).send({ error: 'invalid_address', message: 'Address line is required.' });
    }

    const {latitude,longitude}=coordinates(body);

    const address = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${request.authUser!.id} FOR UPDATE`;
      if (isDefault) {
        await tx.customerAddress.updateMany({
          where: { userId: request.authUser!.id, isDefault: true },
          data: { isDefault: false },
        });
      }

      const existingCount = await tx.customerAddress.count({ where: { userId: request.authUser!.id } });
      return tx.customerAddress.create({
        data: {
          userId: request.authUser!.id,
          label: typeof body.label === 'string' ? body.label.trim() || null : null,
          addressLine,
          city: typeof body.city === 'string' ? body.city.trim() || null : null,
          latitude,
          longitude,
          instructions: typeof body.instructions === 'string' ? body.instructions.trim() || null : null,
          isDefault: isDefault || existingCount === 0,
        },
      });
    });

    return reply.code(201).send(address);
  });

  app.patch('/v1/customer/addresses/:addressId',{preHandler:authenticate},async request=>{
    const {addressId}=request.params as {addressId:string};
    const b=(request.body??{}) as Record<string,unknown>;
    const data:Record<string,unknown>={};
    for(const key of ['addressLine','label','city','instructions'])if(b[key]!==undefined){
      if(typeof b[key]!=='string'||b[key].length>500||(key==='addressLine'&&!b[key].trim()))throw Object.assign(new Error('Invalid address field.'),{statusCode:400});
      data[key]=b[key].trim();
    }
    if(b.latitude!==undefined||b.longitude!==undefined)Object.assign(data,coordinates(b));
    if(b.isDefault!==undefined&&typeof b.isDefault!=='boolean')throw Object.assign(new Error('Invalid default choice.'),{statusCode:400});
    return prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${request.authUser!.id} FOR UPDATE`;
      if(!await tx.customerAddress.findFirst({where:{id:addressId,userId:request.authUser!.id}}))throw Object.assign(new Error('Address not found.'),{statusCode:404});
      if(b.isDefault===true){await tx.customerAddress.updateMany({where:{userId:request.authUser!.id,isDefault:true},data:{isDefault:false}});data.isDefault=true;}
      return tx.customerAddress.update({where:{id:addressId},data});
    });
  });

  app.patch('/v1/customer/addresses/:addressId/default', { preHandler: authenticate }, async (request, reply) => {
    const { addressId } = request.params as { addressId: string };
    await prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${request.authUser!.id} FOR UPDATE`;
      const owned=await tx.customerAddress.findFirst({where:{id:addressId,userId:request.authUser!.id}});
      if(!owned)throw Object.assign(new Error('Address not found.'),{statusCode:404});
      await tx.customerAddress.updateMany({where:{userId:request.authUser!.id,isDefault:true},data:{isDefault:false}});
      await tx.customerAddress.update({where:{id:addressId},data:{isDefault:true}});
    });

    return { success: true };
  });

  app.delete('/v1/customer/addresses/:addressId', { preHandler: authenticate }, async (request, reply) => {
    const { addressId } = request.params as { addressId: string };
    await prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${request.authUser!.id} FOR UPDATE`;
      const owned=await tx.customerAddress.findFirst({where:{id:addressId,userId:request.authUser!.id}});
      if(!owned)throw Object.assign(new Error('Address not found.'),{statusCode:404});
      await tx.customerAddress.delete({where:{id:addressId}});
      if(owned.isDefault){const next=await tx.customerAddress.findFirst({where:{userId:request.authUser!.id},orderBy:{createdAt:'desc'}});if(next)await tx.customerAddress.update({where:{id:next.id},data:{isDefault:true}});}
    });
    return reply.code(204).send();
  });
}
