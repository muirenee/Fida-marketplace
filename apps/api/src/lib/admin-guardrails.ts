import type { FastifyInstance } from 'fastify';
import { DeliveryStatus, OrderStatus, prisma } from '@fida/database/client';
import { requirePlatformAdmin } from './auth.js';

const activeOrderStatuses = [
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.PICKED_UP,
  OrderStatus.DELIVERING,
];

const activeDeliveryStatuses = [
  DeliveryStatus.ASSIGNED,
  DeliveryStatus.AT_PICKUP,
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.AT_DROPOFF,
];

function param(request: { params: unknown }, key: string) {
  const value = (request.params as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' ? value : '';
}

function body(request: { body: unknown }) {
  return (request.body ?? {}) as Record<string, unknown>;
}

export function registerAdminGuardrails(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    if (!request.url.startsWith('/v1/admin/')) return;
    if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return;

    const route = request.routeOptions.url ?? request.url.split('?')[0] ?? request.url;
    const guarded =
      route.includes('/users/:userId/active') ||
      route.includes('/tenants/:tenantId/status') ||
      route.includes('/branches/:branchId') ||
      route.includes('/drivers/:driverId/state');
    if (!guarded) return;

    await requirePlatformAdmin(request, reply);
    if (reply.sent || !request.authUser) return;

    const requestBody = body(request);

    if (route.includes('/users/:userId/active') && requestBody.isActive === false) {
      const userId = param(request, 'userId');
      if (userId === request.authUser.id) {
        return reply.code(409).send({
          error: 'self_deactivation_not_allowed',
          message: 'You cannot disable the administrator account you are currently using.',
        });
      }

      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isPlatformAdmin: true, driver: { select: { id: true } } },
      });
      if (!target) return;

      if (target.isPlatformAdmin) {
        const otherActiveAdmins = await prisma.user.count({
          where: { isPlatformAdmin: true, isActive: true, id: { not: userId } },
        });
        if (otherActiveAdmins === 0) {
          return reply.code(409).send({
            error: 'last_platform_admin_required',
            message: 'At least one other active platform administrator is required before disabling this account.',
          });
        }
      }

      if (target.driver) {
        const activeDelivery = await prisma.delivery.findFirst({
          where: { driverId: target.driver.id, status: { in: activeDeliveryStatuses } },
          select: { id: true, order: { select: { orderNumber: true } } },
        });
        if (activeDelivery) {
          return reply.code(409).send({
            error: 'driver_has_active_delivery',
            message: `This user is handling active delivery ${activeDelivery.order.orderNumber}. Finish or reassign it before disabling the account.`,
          });
        }
      }
    }

    if (route.includes('/tenants/:tenantId/status')) {
      const requestedStatus = typeof requestBody.status === 'string' ? requestBody.status.toUpperCase() : '';
      if (requestedStatus === 'SUSPENDED' || requestedStatus === 'CLOSED') {
        const tenantId = param(request, 'tenantId');
        const activeOrders = await prisma.order.count({
          where: { tenantId, status: { in: activeOrderStatuses } },
        });
        if (activeOrders > 0) {
          return reply.code(409).send({
            error: 'merchant_has_active_orders',
            message: `This merchant has ${activeOrders} active order${activeOrders === 1 ? '' : 's'}. Complete or cancel them before ${requestedStatus.toLowerCase()} the merchant.`,
          });
        }
      }
    }

    if (route.includes('/branches/:branchId') && requestBody.isActive === false) {
      const branchId = param(request, 'branchId');
      const activeOrders = await prisma.order.count({
        where: { branchId, status: { in: activeOrderStatuses } },
      });
      if (activeOrders > 0) {
        return reply.code(409).send({
          error: 'branch_has_active_orders',
          message: `This branch has ${activeOrders} active order${activeOrders === 1 ? '' : 's'}. Pause new orders instead, or finish existing orders before disabling the branch.`,
        });
      }
    }

    if (route.includes('/drivers/:driverId/state') && requestBody.isOnline === false) {
      const driverId = param(request, 'driverId');
      const activeDelivery = await prisma.delivery.findFirst({
        where: { driverId, status: { in: activeDeliveryStatuses } },
        select: { id: true, order: { select: { orderNumber: true } } },
      });
      if (activeDelivery) {
        return reply.code(409).send({
          error: 'driver_has_active_delivery',
          message: `Driver is handling ${activeDelivery.order.orderNumber}. Complete or reassign the delivery before taking the driver offline.`,
        });
      }
    }
  });
}
