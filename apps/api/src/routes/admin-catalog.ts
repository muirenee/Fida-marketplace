import type { FastifyInstance } from 'fastify';
import { Prisma, prisma } from '@fida/database/client';
import { requirePlatformAdmin } from '../lib/auth.js';

const catalogStates = ['ACTIVE', 'INACTIVE', 'UNAVAILABLE', 'AVAILABLE'] as const;
type CatalogState = (typeof catalogStates)[number];

export async function adminCatalogRoutes(app: FastifyInstance) {
  app.get('/v1/admin/catalog/products', { preHandler: requirePlatformAdmin }, async (request) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const search = typeof query.q === 'string' ? query.q.trim() : '';
    const tenantId = typeof query.tenantId === 'string' ? query.tenantId.trim() : '';
    const requestedState = typeof query.state === 'string' ? query.state.toUpperCase() : '';
    const state = catalogStates.includes(requestedState as CatalogState)
      ? (requestedState as CatalogState)
      : undefined;

    const where: Prisma.ProductWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      ...(state === 'ACTIVE' ? { isActive: true } : {}),
      ...(state === 'INACTIVE' ? { isActive: false } : {}),
      ...(state === 'UNAVAILABLE' ? { isAvailable: false } : {}),
      ...(state === 'AVAILABLE' ? { isActive: true, isAvailable: true } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { tenant: { is: { name: { contains: search, mode: 'insensitive' } } } },
              { category: { is: { name: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    return prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        sku: true,
        price: true,
        isActive: true,
        isAvailable: true,
        createdAt: true,
        updatedAt: true,
        tenant: { select: { id: true, name: true, currency: true, status: true } },
        category: { select: { id: true, name: true, isActive: true } },
      },
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
      take: 300,
    });
  });

  app.get('/v1/admin/catalog/categories', { preHandler: requirePlatformAdmin }, async (request) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const tenantId = typeof query.tenantId === 'string' ? query.tenantId.trim() : '';

    return prisma.category.findMany({
      where: tenantId ? { tenantId } : undefined,
      select: {
        id: true,
        name: true,
        slug: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        tenant: { select: { id: true, name: true, currency: true, status: true } },
        _count: { select: { products: true } },
      },
      orderBy: [{ tenant: { name: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
      take: 300,
    });
  });

  app.patch(
    '/v1/admin/catalog/products/:productId',
    { preHandler: requirePlatformAdmin },
    async (request, reply) => {
      const { productId } = request.params as { productId: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const data: { isActive?: boolean; isAvailable?: boolean } = {};

      if ('isActive' in body) {
        if (typeof body.isActive !== 'boolean') {
          return reply.code(400).send({ error: 'invalid_is_active' });
        }
        data.isActive = body.isActive;
      }

      if ('isAvailable' in body) {
        if (typeof body.isAvailable !== 'boolean') {
          return reply.code(400).send({ error: 'invalid_is_available' });
        }
        data.isAvailable = body.isAvailable;
      }

      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: 'catalog_update_required' });
      }

      const existing = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!existing) return reply.code(404).send({ error: 'product_not_found' });

      return prisma.product.update({
        where: { id: productId },
        data,
        select: {
          id: true,
          name: true,
          price: true,
          isActive: true,
          isAvailable: true,
          updatedAt: true,
          tenant: { select: { id: true, name: true, currency: true, status: true } },
          category: { select: { id: true, name: true, isActive: true } },
        },
      });
    },
  );

  app.patch(
    '/v1/admin/catalog/categories/:categoryId/active',
    { preHandler: requirePlatformAdmin },
    async (request, reply) => {
      const { categoryId } = request.params as { categoryId: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      if (typeof body.isActive !== 'boolean') {
        return reply.code(400).send({ error: 'is_active_required' });
      }

      const existing = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
      if (!existing) return reply.code(404).send({ error: 'category_not_found' });

      return prisma.category.update({
        where: { id: categoryId },
        data: { isActive: body.isActive },
        select: {
          id: true,
          name: true,
          slug: true,
          sortOrder: true,
          isActive: true,
          updatedAt: true,
          tenant: { select: { id: true, name: true, currency: true, status: true } },
          _count: { select: { products: true } },
        },
      });
    },
  );
}
