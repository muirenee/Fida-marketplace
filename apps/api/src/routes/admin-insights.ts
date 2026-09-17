import type { FastifyInstance } from 'fastify';
import { PaymentStatus, prisma } from '@fida/database/client';
import { requirePlatformAdmin } from '../lib/auth.js';

export async function adminInsightRoutes(app: FastifyInstance) {
  app.get('/v1/admin/insights/merchants/:tenantId', { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { tenantId } = request.params as { tenantId: string };

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        merchantType: true,
        currency: true,
        timezone: true,
        isAcceptingOrders: true,
        minimumOrder: true,
        defaultDeliveryFee: true,
        serviceFeePercent: true,
        activatedAt: true,
        createdAt: true,
        updatedAt: true,
        branches: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            addressLine: true,
            isActive: true,
            isAcceptingOrders: true,
            _count: { select: { memberships: true, orders: true } },
          },
        },
        memberships: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            createdAt: true,
            branch: { select: { id: true, name: true, city: true } },
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                isActive: true,
                lastLoginAt: true,
              },
            },
          },
        },
        categories: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            slug: true,
            sortOrder: true,
            isActive: true,
            _count: { select: { products: true } },
          },
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 30,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentMethod: true,
            paymentStatus: true,
            total: true,
            createdAt: true,
            branch: { select: { id: true, name: true, city: true } },
            customer: {
              select: { id: true, firstName: true, lastName: true, email: true, phone: true },
            },
            delivery: {
              select: {
                status: true,
                deliveredAt: true,
                driver: {
                  select: {
                    id: true,
                    user: { select: { firstName: true, lastName: true, email: true, phone: true } },
                  },
                },
              },
            },
          },
        },
        _count: { select: { products: true, orders: true, memberships: true, branches: true } },
      },
    });

    if (!tenant) return reply.code(404).send({ error: 'tenant_not_found' });

    const [orderStatuses, paymentStatuses, paidTotals, activeProducts, availableProducts] = await Promise.all([
      prisma.order.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      prisma.order.groupBy({
        by: ['paymentStatus'],
        where: { tenantId },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { tenantId, paymentStatus: PaymentStatus.PAID },
        _count: { _all: true },
        _sum: { total: true, serviceFee: true, deliveryFee: true },
      }),
      prisma.product.count({ where: { tenantId, isActive: true } }),
      prisma.product.count({ where: { tenantId, isActive: true, isAvailable: true } }),
    ]);

    return {
      tenant,
      metrics: {
        activeProducts,
        availableProducts,
        paidOrders: paidTotals._count._all,
        paidValue: paidTotals._sum.total ?? 0,
        paidServiceFees: paidTotals._sum.serviceFee ?? 0,
        paidDeliveryFees: paidTotals._sum.deliveryFee ?? 0,
      },
      orderStatuses: orderStatuses.map((row) => ({ status: row.status, total: row._count._all })),
      paymentStatuses: paymentStatuses.map((row) => ({
        status: row.paymentStatus,
        total: row._count._all,
        orderValue: row._sum.total ?? 0,
      })),
    };
  });

  app.get('/v1/admin/insights/drivers/:driverId', { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { driverId } = request.params as { driverId: string };

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        isOnline: true,
        isAvailable: true,
        latitude: true,
        longitude: true,
        lastSeenAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isActive: true,
            createdAt: true,
            lastLoginAt: true,
          },
        },
        deliveries: {
          orderBy: { assignedAt: 'desc' },
          take: 50,
          select: {
            id: true,
            status: true,
            assignedAt: true,
            pickedUpAt: true,
            deliveredAt: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                paymentStatus: true,
                total: true,
                createdAt: true,
                tenant: { select: { id: true, name: true, currency: true } },
                branch: { select: { id: true, name: true, city: true } },
                customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
              },
            },
          },
        },
        _count: { select: { deliveries: true } },
      },
    });

    if (!driver) return reply.code(404).send({ error: 'driver_not_found' });

    const deliveryStatuses = await prisma.delivery.groupBy({
      by: ['status'],
      where: { driverId },
      _count: { _all: true },
    });

    return {
      driver,
      deliveryStatuses: deliveryStatuses.map((row) => ({ status: row.status, total: row._count._all })),
    };
  });
}
