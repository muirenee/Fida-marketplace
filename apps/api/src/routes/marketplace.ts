import type { FastifyInstance } from 'fastify';
import { MerchantType, Prisma, TenantStatus, prisma } from '@fida/database/client';

const branchSelect = {
  id: true,
  name: true,
  city: true,
  addressLine: true,
  latitude: true,
  longitude: true,
  pickupEnabled: true,
  deliveryEnabled: true,
  logisticsMode: true,
  deliveryZones: {
    where: { isActive: true },
    orderBy: [{ minDistanceKm: 'asc' as const }, { maxDistanceKm: 'asc' as const }],
    select: { id: true, minDistanceKm: true, maxDistanceKm: true, fee: true },
  },
};

const productSelect = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  price: true,
  modifierGroups: {
    orderBy: [{ sortOrder: 'asc' as const }, { name: 'asc' as const }],
    select: {
      id: true,
      name: true,
      minSelections: true,
      maxSelections: true,
      isRequired: true,
      options: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' as const }, { name: 'asc' as const }],
        select: { id: true, name: true, priceDelta: true },
      },
    },
  },
};

export async function marketplaceRoutes(app: FastifyInstance) {
  app.get('/v1/marketplace/merchants', async (request) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const city = typeof query.city === 'string' ? query.city.trim() : '';
    const requestedType = typeof query.type === 'string' ? query.type.toUpperCase() : '';
    const now = new Date();

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
        logoUrl: true,
        coverImageUrl: true,
        minimumOrder: true,
        defaultDeliveryFee: true,
        branches: {
          where: {
            isActive: true,
            isAcceptingOrders: true,
            ...(city ? { city: { equals: city, mode: 'insensitive' } } : {}),
          },
          select: branchSelect,
        },
        promotions: {
          where: {
            isActive: true,
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
              { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
            ],
          },
          select: {
            code: true,
            type: true,
            value: true,
            minimumOrder: true,
            maxDiscount: true,
            usageLimit: true,
            usageCount: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
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
        logoUrl: true,
        coverImageUrl: true,
        minimumOrder: true,
        defaultDeliveryFee: true,
        branches: {
          where: { isActive: true, isAcceptingOrders: true },
          select: branchSelect,
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
              select: productSelect,
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    });

    if (!merchant) return reply.code(404).send({ error: 'merchant_not_found' });
    return merchant;
  });
}
