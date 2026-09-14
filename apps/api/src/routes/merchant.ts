import type { FastifyInstance } from 'fastify';
import { prisma } from '@fida/database/client';
import { merchantWriteRoles, requireTenant } from '../lib/tenant.js';

function cleanSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function merchantRoutes(app: FastifyInstance) {
  app.get('/v1/merchant/context', { preHandler: requireTenant() }, async (request) => {
    const tenantId = request.tenantContext!.tenantId;
    const [branches, categories, products, orders] = await Promise.all([
      prisma.branch.count({ where: { tenantId, isActive: true } }),
      prisma.category.count({ where: { tenantId, isActive: true } }),
      prisma.product.count({ where: { tenantId, isActive: true } }),
      prisma.order.count({ where: { tenantId } }),
    ]);

    return {
      context: request.tenantContext,
      counts: { branches, categories, products, orders },
    };
  });

  app.get('/v1/merchant/categories', { preHandler: requireTenant() }, async (request) => {
    return prisma.category.findMany({
      where: { tenantId: request.tenantContext!.tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  });

  app.post(
    '/v1/merchant/categories',
    { preHandler: requireTenant(merchantWriteRoles) },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const slug = cleanSlug(typeof body.slug === 'string' ? body.slug : name);

      if (!name || !slug) {
        return reply.code(400).send({ error: 'invalid_category' });
      }

      const category = await prisma.category.create({
        data: {
          tenantId: request.tenantContext!.tenantId,
          name,
          slug,
          sortOrder: typeof body.sortOrder === 'number' ? Math.trunc(body.sortOrder) : 0,
        },
      });

      return reply.code(201).send(category);
    },
  );

  app.get('/v1/merchant/products', { preHandler: requireTenant() }, async (request) => {
    return prisma.product.findMany({
      where: { tenantId: request.tenantContext!.tenantId },
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.post(
    '/v1/merchant/products',
    { preHandler: requireTenant(merchantWriteRoles) },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const rawPrice = typeof body.price === 'number' || typeof body.price === 'string' ? Number(body.price) : NaN;
      const categoryId = typeof body.categoryId === 'string' && body.categoryId ? body.categoryId : null;

      if (!name || !Number.isFinite(rawPrice) || rawPrice < 0) {
        return reply.code(400).send({ error: 'invalid_product', message: 'Product name and a valid price are required.' });
      }

      if (categoryId) {
        const category = await prisma.category.findFirst({
          where: { id: categoryId, tenantId: request.tenantContext!.tenantId },
          select: { id: true },
        });
        if (!category) {
          return reply.code(400).send({ error: 'invalid_category', message: 'Category does not belong to this merchant.' });
        }
      }

      const product = await prisma.product.create({
        data: {
          tenantId: request.tenantContext!.tenantId,
          categoryId,
          name,
          description: typeof body.description === 'string' ? body.description.trim() || null : null,
          sku: typeof body.sku === 'string' ? body.sku.trim() || null : null,
          price: rawPrice.toFixed(2),
          isAvailable: typeof body.isAvailable === 'boolean' ? body.isAvailable : true,
        },
      });

      return reply.code(201).send(product);
    },
  );
}
