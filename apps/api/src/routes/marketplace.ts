import { branchIsOpen } from '../lib/business-hours.js';
import type { FastifyInstance } from 'fastify';
import { MerchantType, Prisma, TenantStatus, prisma } from '@fida/database/client';

const branchSelect = {
  id: true,
  name: true,
  city: true,
  addressLine: true,
  latitude: true,
  longitude: true,
  isAcceptingOrders: true,
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

    const merchants = await prisma.tenant.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        merchantType: true,
        currency: true,
        minimumOrder: true,
        timezone: true,
        products: { where: { isActive: true, isAvailable: true, deletedAt: null, imageUrl: { not: null }, OR: [{ categoryId: null }, { category: { isActive: true, deletedAt: null } }] }, select: {imageUrl: true}, orderBy: {name: 'asc'}, take: 1 },
        branches: {
          where: { isActive: true, isAcceptingOrders: true },
          select: branchSelect,
        },
      },
      orderBy: { name: 'asc' },
    });
    const ids = merchants.map(m => m.id);
    const [ratings, promos] = await Promise.all([
      prisma.review.groupBy({by:['tenantId'],where:{tenantId:{in:ids}},_avg:{rating:true},_count:{rating:true}}),
      prisma.promotion.findMany({where:{tenantId:{in:ids},isActive:true,expiresAt:{gt:new Date()}},select:{tenantId:true,code:true,percent:true,minimumOrder:true,maxDiscount:true,usedCount:true,maxUses:true}}),
    ]);
    return merchants.map(({products,...m}) => ({...m, imageUrl:products[0]?.imageUrl ?? null,
      rating:ratings.find(r=>r.tenantId===m.id)?._avg.rating ?? null,
      reviewCount:ratings.find(r=>r.tenantId===m.id)?._count.rating ?? 0,
      promotions:promos.filter(p=>p.tenantId===m.id && p.usedCount<p.maxUses).map(({usedCount,maxUses,tenantId,...p})=>p),
      branches:m.branches.map(b=>({...b,isOpen:branchIsOpen(b,m.timezone)})),
    }));
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
        timezone: true,
        products: { where: { isActive: true, isAvailable: true, deletedAt: null, imageUrl: { not: null }, OR: [{ categoryId: null }, { category: { isActive: true, deletedAt: null } }] }, select: {imageUrl: true}, orderBy: {name: 'asc'}, take: 1 },
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
    const [reviews,promotions] = await Promise.all([
      prisma.review.aggregate({where:{tenantId:merchant.id},_avg:{rating:true},_count:{rating:true}}),
      prisma.promotion.findMany({where:{tenantId:merchant.id,isActive:true,expiresAt:{gt:new Date()}},select:{code:true,percent:true,minimumOrder:true,maxDiscount:true,maxUses:true,usedCount:true}}),
    ]);
    const {products,...publicMerchant}=merchant;
    return { ...publicMerchant, imageUrl:products[0]?.imageUrl??null, rating:reviews._avg.rating, reviewCount:reviews._count.rating,
      promotions:promotions.filter(p=>p.usedCount<p.maxUses).map(({maxUses,usedCount,...p})=>p),
      branches:merchant.branches.map(b=>({...b,isOpen:branchIsOpen(b,merchant.timezone)})), categories: [...merchant.categories, ...(uncategorised.length ? [{ id: 'uncategorised', name: 'More to discover', slug: 'uncategorised', products: uncategorised }] : [])] };
  });
}
