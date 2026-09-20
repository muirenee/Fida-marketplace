import type { FastifyInstance } from 'fastify';
import {
  DeliveryStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  TenantStatus,
  prisma,
} from '@fida/database/client';
import { requirePlatformAdmin } from '../lib/auth.js';

const manageableStatuses = [
  TenantStatus.PENDING,
  TenantStatus.PENDING_APPROVAL,
  TenantStatus.REJECTED,
  TenantStatus.ACTIVE,
  TenantStatus.SUSPENDED,
  TenantStatus.CLOSED,
];

const orderStatuses = Object.values(OrderStatus);
const paymentMethods = Object.values(PaymentMethod);
const paymentStatuses = Object.values(PaymentStatus);
const deliveryStatuses = Object.values(DeliveryStatus);

function numericSetting(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return Number.NaN;
}

export async function adminRoutes(app: FastifyInstance) {
  app.get('/v1/admin/overview', { preHandler: requirePlatformAdmin }, async () => {
    const [tenants, pendingTenants, users, drivers, onlineDrivers, orders] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: {in:[TenantStatus.PENDING,TenantStatus.PENDING_APPROVAL]} } }),
      prisma.user.count(),
      prisma.driver.count({ where: { isActive: true } }),
      prisma.driver.count({ where: { isActive: true, isOnline: true } }),
      prisma.order.count(),
    ]);

    return { tenants, pendingTenants, users, drivers, onlineDrivers, orders };
  });

  app.get('/v1/admin/orders', { preHandler: requirePlatformAdmin }, async (request) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const search = typeof query.q === 'string' ? query.q.trim() : '';
    const requestedStatus = typeof query.status === 'string' ? query.status.toUpperCase() : '';
    const requestedPaymentMethod = typeof query.paymentMethod === 'string' ? query.paymentMethod.toUpperCase() : '';
    const requestedPaymentStatus = typeof query.paymentStatus === 'string' ? query.paymentStatus.toUpperCase() : '';
    const requestedDeliveryStatus = typeof query.deliveryStatus === 'string' ? query.deliveryStatus.toUpperCase() : '';
    const tenantId = typeof query.tenantId === 'string' ? query.tenantId.trim() : '';

    const status = orderStatuses.includes(requestedStatus as OrderStatus) ? (requestedStatus as OrderStatus) : undefined;
    const paymentMethod = paymentMethods.includes(requestedPaymentMethod as PaymentMethod) ? (requestedPaymentMethod as PaymentMethod) : undefined;
    const paymentStatus = paymentStatuses.includes(requestedPaymentStatus as PaymentStatus) ? (requestedPaymentStatus as PaymentStatus) : undefined;
    const deliveryStatus = deliveryStatuses.includes(requestedDeliveryStatus as DeliveryStatus) ? (requestedDeliveryStatus as DeliveryStatus) : undefined;

    return prisma.order.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
        ...(tenantId ? { tenantId } : {}),
        ...(deliveryStatus ? { delivery: { is: { status: deliveryStatus } } } : {}),
        ...(search
          ? {
              OR: [
                { orderNumber: { contains: search, mode: 'insensitive' as const } },
                { tenant: { is: { name: { contains: search, mode: 'insensitive' as const } } } },
                { customer: { is: { email: { contains: search, mode: 'insensitive' as const } } } },
                { customer: { is: { phone: { contains: search } } } },
                { customer: { is: { firstName: { contains: search, mode: 'insensitive' as const } } } },
                { customer: { is: { lastName: { contains: search, mode: 'insensitive' as const } } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        fulfillmentType: true,
        paymentMethod: true,
        paymentStatus: true,
        subtotal: true,
        deliveryFee: true,
        serviceFee: true,
        discount: true,
        total: true,
        platformCommissionPercent: true,
        platformCommissionAmount: true,
        deliveryDistanceKm: true,
        deliveryAddress: true,
        createdAt: true,
        updatedAt: true,
        tenant: { select: { id: true, name: true, currency: true } },
        branch: { select: { id: true, name: true, city: true } },
        customer: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
        delivery: {
          select: {
            id: true,
            status: true,
            assignedAt: true,
            pickedUpAt: true,
            deliveredAt: true,
            operator: { select: { id: true, name: true, type: true } },
            driver: {
              select: {
                id: true,
                isOnline: true,
                user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  });

  app.get('/v1/admin/orders/:orderId', { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        tenant: { select: { id: true, name: true, currency: true } },
        branch: { select: { id: true, name: true, city: true, addressLine: true } },
        customer: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
        items: {
          select: { id: true, productId: true, productName: true, quantity: true, unitPrice: true, totalPrice: true },
        },
        delivery: {
          include: {
            operator: true,
            driver: {
              include: {
                user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    if (!order) return reply.code(404).send({ error: 'order_not_found' });
    return order;
  });

  app.get('/v1/admin/users', { preHandler: requirePlatformAdmin }, async (request) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const search = typeof query.q === 'string' ? query.q.trim() : '';

    return prisma.user.findMany({
      where: search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isPlatformAdmin: true,
        createdAt: true,
        driver: {
          select: {
            id: true,
            isActive: true,
            isOnline: true,
            isAvailable: true,
            lastSeenAt: true,
            operator: { select: { id: true, name: true, type: true, tenantId: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  app.patch('/v1/admin/users/:userId/active', { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    if (typeof body.isActive !== 'boolean') return reply.code(400).send({ error: 'is_active_required' });

    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!existing) return reply.code(404).send({ error: 'user_not_found' });

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive: body.isActive },
      select: { id: true, email: true, phone: true, firstName: true, lastName: true, isActive: true },
    });

    if (!body.isActive) {
      await prisma.driver.updateMany({ where: { userId }, data: { isOnline: false, isAvailable: false } });
      await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return user;
  });

  app.get('/v1/admin/drivers', { preHandler: requirePlatformAdmin }, async () => {
    return prisma.driver.findMany({
      include: {
        user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true, isActive: true } },
        operator: { include: { tenant: { select: { id: true, name: true } } } },
        branch: { select: { id: true, name: true, city: true } },
        _count: { select: { deliveries: true } },
      },
      orderBy: { lastSeenAt: 'desc' },
    });
  });

  app.post('/v1/admin/drivers', { preHandler: requirePlatformAdmin }, async (_request, reply) => {
    return reply.code(409).send({
      error: 'merchant_driver_enrollment_required',
      message: 'Merchant drivers are enrolled and managed by their merchant. Platform Admin has oversight only.',
    });
  });

  app.get('/v1/admin/tenants', { preHandler: requirePlatformAdmin }, async (request) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const requestedStatus = typeof query.status === 'string' ? query.status.toUpperCase() : null;
    const status = manageableStatuses.includes(requestedStatus as TenantStatus) ? (requestedStatus as TenantStatus) : undefined;

    return prisma.tenant.findMany({
      where: status ? { status } : undefined,
      include: {
        branches: { select: { id: true, name: true, city: true, isActive: true } },
        _count: { select: { memberships: true, products: true, orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.patch('/v1/admin/tenants/:tenantId/settings', { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { tenantId } = request.params as { tenantId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const data: {
      isAcceptingOrders?: boolean;
      minimumOrder?: number;
      defaultDeliveryFee?: number;
      serviceFeePercent?: number;
      platformCommissionPercent?: number;
    } = {};

    if ('isAcceptingOrders' in body) {
      if (typeof body.isAcceptingOrders !== 'boolean') return reply.code(400).send({ error: 'invalid_is_accepting_orders' });
      data.isAcceptingOrders = body.isAcceptingOrders;
    }

    if ('minimumOrder' in body) {
      const value = numericSetting(body.minimumOrder);
      if (!Number.isFinite(value) || value < 0) return reply.code(400).send({ error: 'invalid_minimum_order' });
      data.minimumOrder = value;
    }

    // Retained for backward-compatible admin clients. New customer orders do not use these legacy fee fields.
    if ('defaultDeliveryFee' in body) {
      const value = numericSetting(body.defaultDeliveryFee);
      if (!Number.isFinite(value) || value < 0) return reply.code(400).send({ error: 'invalid_delivery_fee' });
      data.defaultDeliveryFee = value;
    }
    if ('serviceFeePercent' in body) {
      const value = numericSetting(body.serviceFeePercent);
      if (!Number.isFinite(value) || value < 0 || value > 100) return reply.code(400).send({ error: 'invalid_service_fee_percent' });
      data.serviceFeePercent = value;
    }
    if ('platformCommissionPercent' in body) {
      const value = numericSetting(body.platformCommissionPercent);
      if (!Number.isFinite(value) || value < 0 || value > 100) return reply.code(400).send({ error: 'invalid_platform_commission_percent' });
      data.platformCommissionPercent = value;
    }

    if (Object.keys(data).length === 0) return reply.code(400).send({ error: 'settings_required' });
    const existing = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!existing) return reply.code(404).send({ error: 'tenant_not_found' });

    return prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: {
        id: true,
        name: true,
        currency: true,
        status: true,
        isAcceptingOrders: true,
        minimumOrder: true,
        platformCommissionPercent: true,
        updatedAt: true,
      },
    });
  });

  app.patch('/v1/admin/tenants/:tenantId/status', { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const params = request.params as { tenantId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const requestedStatus = typeof body.status === 'string' ? body.status.toUpperCase() : '';

    if (!manageableStatuses.includes(requestedStatus as TenantStatus)) {
      return reply.code(400).send({ error: 'invalid_status', allowed: manageableStatuses });
    }

    const existing = await prisma.tenant.findUnique({ where: { id: params.tenantId } });
    if (!existing) return reply.code(404).send({ error: 'tenant_not_found' });

    if (await prisma.merchantApplication.findUnique({where:{tenantId:existing.id}}) && ['PENDING_APPROVAL','REJECTED'].includes(existing.status)) {
      return reply.code(409).send({error:'application_review_required',message:'Use the merchant application review board.'});
    }
    const status = requestedStatus as TenantStatus;
    return prisma.tenant.update({
      where: { id: params.tenantId },
      data: {
        status,
        activatedAt: status === TenantStatus.ACTIVE && !existing.activatedAt ? new Date() : existing.activatedAt,
      },
    });
  });
}
