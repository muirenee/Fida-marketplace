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
      where: { userId: request.authUser!.id },
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

  app.post('/v1/tenants', { preHandler: authenticate }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const slug = slugify(typeof body.slug === 'string' ? body.slug : name);
    const merchantType = typeof body.merchantType === 'string' ? body.merchantType : '';
    const branchName = typeof body.branchName === 'string' ? body.branchName.trim() : 'Main Branch';
    const city = typeof body.city === 'string' ? body.city.trim() || null : null;
    const addressLine = typeof body.addressLine === 'string' ? body.addressLine.trim() || null : null;

    if (name.length < 2 || !slug) {
      return reply.code(400).send({ error: 'invalid_merchant', message: 'Merchant name is required.' });
    }

    if (!Object.values(MerchantType).includes(merchantType as MerchantType)) {
      return reply.code(400).send({
        error: 'invalid_merchant_type',
        allowed: Object.values(MerchantType),
      });
    }

    const slugExists = await prisma.tenant.findUnique({ where: { slug } });
    if (slugExists) {
      return reply.code(409).send({ error: 'slug_in_use', message: 'This merchant URL slug is already in use.' });
    }

    const tenant = await prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          name,
          slug,
          merchantType: merchantType as MerchantType,
          currency: typeof body.currency === 'string' ? body.currency.trim().toUpperCase().slice(0, 3) : 'RWF',
          timezone: typeof body.timezone === 'string' ? body.timezone.trim() : 'Africa/Kigali',
        },
      });

      const branch = await tx.branch.create({
        data: {
          tenantId: created.id,
          name: branchName || 'Main Branch',
          code: 'MAIN',
          city,
          addressLine,
        },
      });

      await tx.tenantMembership.create({
        data: {
          tenantId: created.id,
          userId: request.authUser!.id,
          role: MembershipRole.OWNER,
          branchId: null,
        },
      });

      return { ...created, branches: [branch] };
    });

    return reply.code(201).send({
      tenant,
      message: 'Merchant created and awaiting platform approval.',
    });
  });
}
