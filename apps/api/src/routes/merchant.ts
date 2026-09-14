import type { FastifyInstance } from 'fastify';
import {
  DeliveryStatus,
  MembershipRole,
  OrderStatus,
  prisma,
} from '@fida/database/client';
import { merchantWriteRoles, requireTenant } from '../lib/tenant.js';

const merchantAdminRoles = [MembershipRole.OWNER, MembershipRole.ADMIN];

const orderTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.ACCEPTED, OrderStatus.REJECTED],
  [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING],
  [OrderStatus.PREPARING]: [OrderStatus.READY_FOR_PICKUP],
};

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
    const [tenant, branches, categories, products, orders] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          merchantType: true,
          currency: true,
          isAcceptingOrders: true,
          minimumOrder: true,
          defaultDeliveryFee: true,
          serviceFeePercent: true,
        },
      }),
      prisma.branch.count({ where: { tenantId, isActive: true } }),
      prisma.category.count({ where: { tenantId, isActive: true } }),
      prisma.product.count({ where: { tenantId, isActive: true } }),
      prisma.order.count({ where: { tenantId } }),
    ]);

    return {
      context: request.tenantContext,
      tenant,
      counts: { branches, categories, products, orders },
    };
  });

  app.patch(
    '/v1/merchant/settings',
    { preHandler: requireTenant(merchantAdminRoles) },
    async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const data: {
        isAcceptingOrders?: boolean;
        minimumOrder?: string;
        defaultDeliveryFee?: string;
        serviceFeePercent?: string;
      } = {};

      if (typeof body.isAcceptingOrders === 'boolean') {
        data.isAcceptingOrders = body.isAcceptingOrders;
      }

      const numberFields = [
        ['minimumOrder', 0, 100000000],
        ['defaultDeliveryFee', 0, 100000000],
        ['serviceFeePercent', 0, 100],
      ] as const;

      for (const [field, min, max] of numberFields) {
        if (body[field] === undefined) continue;
        const value = Number(body[field]);
        if (!Number.isFinite(value) || value < min || value > max) {
          return reply.code(400).send({ error: 'invalid_setting', field, min, max });
        }
        data[field] = value.toFixed(2);
      }

      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: 'no_settings_provided' });
      }

      return prisma.tenant.update({
        where: { id: request.tenantContext!.tenantId },
        data,
        select: {
          id: true,
          isAcceptingOrders: true,
          minimumOrder: true,
          defaultDeliveryFee: true,
          serviceFeePercent: true,
        },
      });
    },
  );

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

  app.get('/v1/merchant/orders', { preHandler: requireTenant() }, async (request, reply) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const requestedStatus = typeof query.status === 'string' ? query.status.toUpperCase() : null;

    if (requestedStatus && !Object.values(OrderStatus).includes(requestedStatus as OrderStatus)) {
      return reply.code(400).send({ error: 'invalid_order_status', allowed: Object.values(OrderStatus) });
    }

    return prisma.order.findMany({
      where: {
        tenantId: request.tenantContext!.tenantId,
        ...(requestedStatus ? { status: requestedStatus as OrderStatus } : {}),
      },
      include: {
        branch: { select: { id: true, name: true, city: true } },
        customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        items: true,
        delivery: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  });

  app.patch(
    '/v1/merchant/orders/:orderId/status',
    { preHandler: requireTenant(merchantWriteRoles) },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const requestedStatus = typeof body.status === 'string' ? body.status.toUpperCase() : '';

      if (!Object.values(OrderStatus).includes(requestedStatus as OrderStatus)) {
        return reply.code(400).send({ error: 'invalid_order_status', allowed: Object.values(OrderStatus) });
      }

      const order = await prisma.order.findFirst({
        where: { id: orderId, tenantId: request.tenantContext!.tenantId },
        select: { id: true, status: true },
      });

      if (!order) return reply.code(404).send({ error: 'order_not_found' });

      const nextStatus = requestedStatus as OrderStatus;
      const allowed = orderTransitions[order.status] ?? [];
      if (!allowed.includes(nextStatus)) {
        return reply.code(409).send({
          error: 'invalid_order_transition',
          currentStatus: order.status,
          allowed,
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const changed = await tx.order.update({
          where: { id: order.id },
          data: { status: nextStatus },
          include: { items: true, delivery: true },
        });

        if (nextStatus === OrderStatus.REJECTED) {
          await tx.delivery.updateMany({
            where: { orderId: order.id },
            data: { status: DeliveryStatus.CANCELLED },
          });
        }

        return changed;
      });

      return updated;
    },
  );
}
