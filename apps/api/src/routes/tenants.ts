import type { FastifyInstance } from 'fastify';
import { MerchantType, MembershipRole, prisma } from '@fida/database/client';
import { authenticate } from '../lib/auth.js';

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function tenantRoutes(app: FastifyInstance) {
  app.get('/v1/tenants', { preHandler: authenticate }, async (request) => {
    return prisma.tenantMembership.findMany({
      where: { userId: request.authUser!.id, isActive: true },
      select: {
        role: true,
        branchId: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            merchantType: true,
            currency: true,
            timezone: true,
            activatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  });

  app.post('/v1/tenants', { preHandler: authenticate }, async (_request, reply) => {
    return reply.code(409).send({error:'application_required',message:'Complete the merchant application at /merchant/register before requesting approval.'});
  });
}
