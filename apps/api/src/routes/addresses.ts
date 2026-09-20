import type { FastifyInstance } from 'fastify';
import { prisma } from '@fida/database/client';
import { authenticate } from '../lib/auth.js';

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

    if (!addressLine) {
      return reply.code(400).send({ error: 'invalid_address', message: 'Address line is required.' });
    }

    const latitude = typeof body.latitude === 'number' && Number.isFinite(body.latitude) ? body.latitude : null;
    const longitude = typeof body.longitude === 'number' && Number.isFinite(body.longitude) ? body.longitude : null;

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
