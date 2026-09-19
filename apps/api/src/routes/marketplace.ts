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
  openingHours: true,
  closedUntil: true,
  deliveryZones: {
    where: { isActive: true },
    orderBy: [{ minDistanceKm: 'asc' as const }, { maxDistanceKm: 'asc' as const }],
    select: { id: true, minDistanceKm: true, maxDistanceKm: true, fee: true },
  },
} satisfies Prisma.BranchSelect;

export async function marketplaceRoutes(app: FastifyInstance) {
  app.get('/v1/marketplace/merchants', async (request) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const city = typeof query.city === 'string' ? query.city.trim() : '';
    const requestedType = typeof query.type === 'string' ? query.type.toUpperCase() : '';

    const search = typeof query.q === 'string' ? query.q.trim().slice(0,100) : '';
    const where: Prisma.TenantWhereInput = {
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { products: { some: { name: { contains: search, mode: 'insensitive' }, isActive: true, isAvailable: true, deletedAt: null } } }] } : {}),
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
        branches: {
          where: { isActive: true, isAcceptingOrders: true },
          select: branchSelect,
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
        branches: {
          where: { isActive: true, isAcceptingOrders: true },
          select: branchSelect,
          orderBy: { name: 'asc' },
        },
        categories: {
          where: { isActive: true, deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            slug: true,
            products: {
              where: { isActive: true, isAvailable: true, deletedAt: null },
              select: { id: true, name: true, description: true, price: true, imageUrl: true, options: true },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    });

    if (!merchant) return reply.code(404).send({ error: 'merchant_not_found' });
    const uncategorised = await prisma.product.findMany({ where: { tenantId: merchant.id, categoryId: null, isActive: true, isAvailable: true, deletedAt: null }, select: { id: true, name: true, description: true, price: true, imageUrl: true, options: true } });
    return { ...merchant, categories: [...merchant.categories, ...(uncategorised.length ? [{ id: 'uncategorised', name: 'More to discover', slug: 'uncategorised', products: uncategorised }] : [])] };
  });
}
