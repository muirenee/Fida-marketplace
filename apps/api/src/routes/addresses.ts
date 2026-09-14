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
    const owned = await prisma.customerAddress.findFirst({
      where: { id: addressId, userId: request.authUser!.id },
      select: { id: true },
    });

    if (!owned) return reply.code(404).send({ error: 'address_not_found' });

    await prisma.$transaction([
      prisma.customerAddress.updateMany({
        where: { userId: request.authUser!.id, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.customerAddress.update({ where: { id: addressId }, data: { isDefault: true } }),
    ]);

    return { success: true };
  });

  app.delete('/v1/customer/addresses/:addressId', { preHandler: authenticate }, async (request, reply) => {
    const { addressId } = request.params as { addressId: string };
    const owned = await prisma.customerAddress.findFirst({
      where: { id: addressId, userId: request.authUser!.id },
      select: { id: true },
    });

    if (!owned) return reply.code(404).send({ error: 'address_not_found' });
    await prisma.customerAddress.delete({ where: { id: addressId } });
    return reply.code(204).send();
  });
}
