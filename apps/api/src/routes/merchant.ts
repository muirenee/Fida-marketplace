import type { FastifyInstance } from 'fastify';
import {
  DeliveryOperatorType,
  DeliveryStatus,
  FulfillmentType,
  LogisticsMode,
  MembershipRole,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
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

async function merchantOperator(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) return null;
  return prisma.deliveryOperator.upsert({
    where: { tenantId },
    update: { name: `${tenant.name} delivery`, type: DeliveryOperatorType.MERCHANT, isActive: true },
    create: { tenantId, name: `${tenant.name} delivery`, type: DeliveryOperatorType.MERCHANT },
  });
}

async function ownedBranch(tenantId: string, branchId: string) {
  return prisma.branch.findFirst({ where: { id: branchId, tenantId }, select: { id: true, latitude: true, longitude: true } });
}

export async function merchantRoutes(app: FastifyInstance) {
  app.get('/v1/merchant/context', { preHandler: requireTenant() }, async (request) => {
    const tenantId = request.tenantContext!.tenantId;
    const [tenant, branches, categories, products, orders, drivers] = await Promise.all([
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
        },
      }),
      prisma.branch.count({ where: { tenantId, isActive: true } }),
      prisma.category.count({ where: { tenantId, isActive: true } }),
      prisma.product.count({ where: { tenantId, isActive: true } }),
      prisma.order.count({ where: { tenantId } }),
      prisma.driver.count({ where: { operator: { is: { tenantId } }, isActive: true } }),
    ]);

    return { context: request.tenantContext, tenant, counts: { branches, categories, products, orders, drivers } };
  });

  app.patch('/v1/merchant/settings', { preHandler: requireTenant(merchantAdminRoles) }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const data: { isAcceptingOrders?: boolean; minimumOrder?: string } = {};

    if (typeof body.isAcceptingOrders === 'boolean') data.isAcceptingOrders = body.isAcceptingOrders;
    if (body.minimumOrder !== undefined) {
      const value = Number(body.minimumOrder);
      if (!Number.isFinite(value) || value < 0 || value > 100000000) {
        return reply.code(400).send({ error: 'invalid_setting', field: 'minimumOrder', min: 0, max: 100000000 });
      }
      data.minimumOrder = value.toFixed(2);
    }

    if (Object.keys(data).length === 0) return reply.code(400).send({ error: 'no_settings_provided' });

    return prisma.tenant.update({
      where: { id: request.tenantContext!.tenantId },
      data,
      select: { id: true, isAcceptingOrders: true, minimumOrder: true },
    });
  });

  app.get('/v1/merchant/fulfillment', { preHandler: requireTenant() }, async (request) => {
    return prisma.branch.findMany({
      where: { tenantId: request.tenantContext!.tenantId },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        addressLine: true,
        latitude: true,
        longitude: true,
        isActive: true,
        isAcceptingOrders: true,
        pickupEnabled: true,
        deliveryEnabled: true,
        logisticsMode: true,
        deliveryZones: {
          orderBy: [{ minDistanceKm: 'asc' }, { maxDistanceKm: 'asc' }],
        },
      },
      orderBy: { name: 'asc' },
    });
  });

  app.patch('/v1/merchant/branches/:branchId/fulfillment', { preHandler: requireTenant(merchantAdminRoles) }, async (request, reply) => {
    const { branchId } = request.params as { branchId: string };
    const tenantId = request.tenantContext!.tenantId;
    const branch = await ownedBranch(tenantId, branchId);
    if (!branch) return reply.code(404).send({ error: 'branch_not_found' });

    const body = (request.body ?? {}) as Record<string, unknown>;
    const data: {
      pickupEnabled?: boolean;
      deliveryEnabled?: boolean;
      logisticsMode?: LogisticsMode;
      latitude?: number | null;
      longitude?: number | null;
    } = {};

    if (typeof body.pickupEnabled === 'boolean') data.pickupEnabled = body.pickupEnabled;
    if (typeof body.deliveryEnabled === 'boolean') data.deliveryEnabled = body.deliveryEnabled;

    if (body.logisticsMode !== undefined) {
      const mode = typeof body.logisticsMode === 'string' ? body.logisticsMode.toUpperCase() : '';
      if (!Object.values(LogisticsMode).includes(mode as LogisticsMode)) {
        return reply.code(400).send({ error: 'invalid_logistics_mode', allowed: Object.values(LogisticsMode) });
      }
      if (mode !== LogisticsMode.MERCHANT) {
        const fidaFleet = await prisma.deliveryOperator.findFirst({
          where: { type: DeliveryOperatorType.FIDA, tenantId: null, isActive: true },
          select: { id: true },
        });
        if (!fidaFleet) {
          return reply.code(409).send({
            error: 'fida_delivery_not_available',
            message: 'Fida-managed delivery is not enabled yet. Keep this branch on merchant delivery.',
          });
        }
      }
      data.logisticsMode = mode as LogisticsMode;
    }

    if (body.latitude !== undefined || body.longitude !== undefined) {
      const latitude = body.latitude === null ? null : Number(body.latitude);
      const longitude = body.longitude === null ? null : Number(body.longitude);
      if (
        latitude !== null &&
        (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
      ) return reply.code(400).send({ error: 'invalid_latitude' });
      if (
        longitude !== null &&
        (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
      ) return reply.code(400).send({ error: 'invalid_longitude' });
      data.latitude = latitude;
      data.longitude = longitude;
    }

    if (Object.keys(data).length === 0) return reply.code(400).send({ error: 'settings_required' });

    return prisma.branch.update({
      where: { id: branchId },
      data,
      include: { deliveryZones: { orderBy: { minDistanceKm: 'asc' } } },
    });
  });

  app.put('/v1/merchant/branches/:branchId/delivery-zones', { preHandler: requireTenant(merchantAdminRoles) }, async (request, reply) => {
    const { branchId } = request.params as { branchId: string };
    const tenantId = request.tenantContext!.tenantId;
    const branch = await ownedBranch(tenantId, branchId);
    if (!branch) return reply.code(404).send({ error: 'branch_not_found' });

    const body = (request.body ?? {}) as Record<string, unknown>;
    if (!Array.isArray(body.zones) || body.zones.length > 20) {
      return reply.code(400).send({ error: 'invalid_delivery_zones' });
    }

    const zones = body.zones.map((raw, index) => {
      const zone = raw as Record<string, unknown>;
      return {
        index,
        minDistanceKm: Number(zone.minDistanceKm),
        maxDistanceKm: Number(zone.maxDistanceKm),
        fee: Number(zone.fee),
      };
    }).sort((a, b) => a.minDistanceKm - b.minDistanceKm);

    for (let index = 0; index < zones.length; index += 1) {
      const zone = zones[index]!;
      if (!Number.isFinite(zone.minDistanceKm) || !Number.isFinite(zone.maxDistanceKm) || !Number.isFinite(zone.fee)) {
        return reply.code(400).send({ error: 'invalid_delivery_zone_number', index: zone.index });
      }
      if (zone.minDistanceKm < 0 || zone.maxDistanceKm <= zone.minDistanceKm || zone.fee < 0) {
        return reply.code(400).send({ error: 'invalid_delivery_zone_range', index: zone.index });
      }
      const previous = zones[index - 1];
      if (previous && zone.minDistanceKm < previous.maxDistanceKm) {
        return reply.code(400).send({ error: 'overlapping_delivery_zones', index: zone.index });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.deliveryZone.deleteMany({ where: { branchId } });
      if (zones.length > 0) {
        await tx.deliveryZone.createMany({
          data: zones.map((zone) => ({
            branchId,
            minDistanceKm: zone.minDistanceKm.toFixed(2),
            maxDistanceKm: zone.maxDistanceKm.toFixed(2),
            fee: zone.fee.toFixed(2),
          })),
        });
      }
    });

    return prisma.deliveryZone.findMany({ where: { branchId }, orderBy: { minDistanceKm: 'asc' } });
  });

  app.get('/v1/merchant/drivers', { preHandler: requireTenant() }, async (request) => {
    const tenantId = request.tenantContext!.tenantId;
    return prisma.driver.findMany({
      where: { operator: { is: { tenantId } } },
      include: {
        user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true, isActive: true } },
        branch: { select: { id: true, name: true, city: true } },
        _count: { select: { deliveries: true } },
      },
      orderBy: [{ isActive: 'desc' }, { lastSeenAt: 'desc' }],
    });
  });

  app.post('/v1/merchant/drivers', { preHandler: requireTenant(merchantAdminRoles) }, async (request, reply) => {
    const tenantId = request.tenantContext!.tenantId;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const identity = typeof body.emailOrPhone === 'string' ? body.emailOrPhone.trim() : '';
    const branchId = typeof body.branchId === 'string' && body.branchId ? body.branchId : null;
    if (!userId && !identity) return reply.code(400).send({ error: 'driver_user_required' });

    if (branchId && !await ownedBranch(tenantId, branchId)) return reply.code(400).send({ error: 'invalid_branch' });

    const user = await prisma.user.findFirst({
      where: userId
        ? { id: userId }
        : { OR: [{ email: { equals: identity, mode: 'insensitive' } }, { phone: identity }] },
      select: { id: true, isActive: true, driver: { select: { id: true, operatorId: true } } },
    });
    if (!user) return reply.code(404).send({ error: 'user_not_found', message: 'No active Fida user matches that email or phone.' });
    if (!user.isActive) return reply.code(409).send({ error: 'user_inactive' });

    const operator = await merchantOperator(tenantId);
    if (!operator) return reply.code(404).send({ error: 'merchant_not_found' });
    if (user.driver?.operatorId && user.driver.operatorId !== operator.id) {
      return reply.code(409).send({ error: 'driver_belongs_to_another_operator' });
    }

    const driver = user.driver
      ? await prisma.driver.update({
          where: { id: user.driver.id },
          data: { operatorId: operator.id, branchId, isActive: true },
          include: { user: true, branch: true, operator: true },
        })
      : await prisma.driver.create({
          data: { userId: user.id, operatorId: operator.id, branchId },
          include: { user: true, branch: true, operator: true },
        });

    return reply.code(user.driver ? 200 : 201).send(driver);
  });

  app.patch('/v1/merchant/drivers/:driverId', { preHandler: requireTenant(merchantAdminRoles) }, async (request, reply) => {
    const tenantId = request.tenantContext!.tenantId;
    const { driverId } = request.params as { driverId: string };
    const driver = await prisma.driver.findFirst({ where: { id: driverId, operator: { is: { tenantId } } }, select: { id: true } });
    if (!driver) return reply.code(404).send({ error: 'driver_not_found' });

    const body = (request.body ?? {}) as Record<string, unknown>;
    const data: { isActive?: boolean; branchId?: string | null; isOnline?: boolean; isAvailable?: boolean } = {};
    if (typeof body.isActive === 'boolean') {
      data.isActive = body.isActive;
      if (!body.isActive) {
        data.isOnline = false;
        data.isAvailable = false;
      }
    }
    if ('branchId' in body) {
      const branchId = typeof body.branchId === 'string' && body.branchId ? body.branchId : null;
      if (branchId && !await ownedBranch(tenantId, branchId)) return reply.code(400).send({ error: 'invalid_branch' });
      data.branchId = branchId;
    }
    if (Object.keys(data).length === 0) return reply.code(400).send({ error: 'driver_settings_required' });

    return prisma.driver.update({ where: { id: driver.id }, data, include: { user: true, branch: true, operator: true } });
  });

  app.get('/v1/merchant/categories', { preHandler: requireTenant() }, async (request) => {
    return prisma.category.findMany({
      where: { tenantId: request.tenantContext!.tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  });

  app.post('/v1/merchant/categories', { preHandler: requireTenant(merchantWriteRoles) }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const slug = cleanSlug(typeof body.slug === 'string' ? body.slug : name);
    if (!name || !slug) return reply.code(400).send({ error: 'invalid_category' });

    const category = await prisma.category.create({
      data: {
        tenantId: request.tenantContext!.tenantId,
        name,
        slug,
        sortOrder: typeof body.sortOrder === 'number' ? Math.trunc(body.sortOrder) : 0,
      },
    });
    return reply.code(201).send(category);
  });

  app.get('/v1/merchant/products', { preHandler: requireTenant() }, async (request) => {
    return prisma.product.findMany({
      where: { tenantId: request.tenantContext!.tenantId },
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.post('/v1/merchant/products', { preHandler: requireTenant(merchantWriteRoles) }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const rawPrice = typeof body.price === 'number' || typeof body.price === 'string' ? Number(body.price) : NaN;
    const categoryId = typeof body.categoryId === 'string' && body.categoryId ? body.categoryId : null;

    if (!name || !Number.isFinite(rawPrice) || rawPrice < 0) {
      return reply.code(400).send({ error: 'invalid_product', message: 'Product name and a valid price are required.' });
    }
    if (categoryId) {
      const category = await prisma.category.findFirst({ where: { id: categoryId, tenantId: request.tenantContext!.tenantId }, select: { id: true } });
      if (!category) return reply.code(400).send({ error: 'invalid_category', message: 'Category does not belong to this merchant.' });
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
  });

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
        delivery: { include: { driver: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  });

  app.patch('/v1/merchant/orders/:orderId/status', { preHandler: requireTenant(merchantWriteRoles) }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const requestedStatus = typeof body.status === 'string' ? body.status.toUpperCase() : '';
    if (!Object.values(OrderStatus).includes(requestedStatus as OrderStatus)) {
      return reply.code(400).send({ error: 'invalid_order_status', allowed: Object.values(OrderStatus) });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId: request.tenantContext!.tenantId },
      select: { id: true, status: true, fulfillmentType: true, paymentMethod: true, paymentStatus: true },
    });
    if (!order) return reply.code(404).send({ error: 'order_not_found' });

    const nextStatus = requestedStatus as OrderStatus;
    const allowed = [...(orderTransitions[order.status] ?? [])];
    if (order.status === OrderStatus.READY_FOR_PICKUP && order.fulfillmentType === FulfillmentType.PICKUP) allowed.push(OrderStatus.COMPLETED);
    if (!allowed.includes(nextStatus)) {
      return reply.code(409).send({ error: 'invalid_order_transition', currentStatus: order.status, allowed });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.order.update({ where: { id: order.id }, data: { status: nextStatus }, include: { items: true, delivery: true } });

      if (nextStatus === OrderStatus.REJECTED) {
        await tx.delivery.updateMany({ where: { orderId: order.id }, data: { status: DeliveryStatus.CANCELLED } });
      }
      if (
        nextStatus === OrderStatus.COMPLETED &&
        order.fulfillmentType === FulfillmentType.PICKUP &&
        order.paymentMethod === PaymentMethod.CASH &&
        order.paymentStatus === PaymentStatus.PENDING
      ) {
        await tx.order.update({ where: { id: order.id }, data: { paymentStatus: PaymentStatus.PAID } });
      }
      return changed;
    });

    return updated;
  });
}
