import type { FastifyInstance } from 'fastify';
import { MerchantType, Prisma, TenantStatus, prisma } from '@fida/database/client';

export async function marketplaceRoutes(app: FastifyInstance) {
  app.get('/v1/marketplace/merchants', async (request) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const city = typeof query.city === 'string' ? query.city.trim() : '';
    const requestedType = typeof query.type === 'string' ? query.type.toUpperCase() : '';

    const where: Prisma.TenantWhereInput = {
      status: TenantStatus.ACTIVE,
      isAcceptingOrders: true,
      branches: {
        some: {
          isActive: true,
          isAcceptingOrders: true,
          ...(city ? { city: { equals: city, mode: 'insensitive' } } : {}),
        },
      },
    };

    if (Object.values(MerchantType).includes(requestedType as MerchantType)) {
      where.merchantType = requestedType as MerchantType;
    }

    return prisma.tenant.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        merchantType: true,
        currency: true,
        minimumOrder: true,
        defaultDeliveryFee: true,
        serviceFeePercent: true,
        branches: {
          where: { isActive: true, isAcceptingOrders: true },
          select: { id: true, name: true, city: true, addressLine: true, latitude: true, longitude: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  });

  app.get('/v1/marketplace/merchants/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const merchant = await prisma.tenant.findFirst({
      where: {
        slug,
        status: TenantStatus.ACTIVE,
        isAcceptingOrders: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        merchantType: true,
        currency: true,
        minimumOrder: true,
        defaultDeliveryFee: true,
        serviceFeePercent: true,
        branches: {
          where: { isActive: true, isAcceptingOrders: true },
          select: { id: true, name: true, city: true, addressLine: true, latitude: true, longitude: true },
          orderBy: { name: 'asc' },
        },
        categories: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            slug: true,
            products: {
              where: { isActive: true, isAvailable: true },
              select: { id: true, name: true, description: true, price: true },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    });

    if (!merchant) {
      return reply.code(404).send({ error: 'merchant_not_found' });
    }

    return merchant;
  });
}
