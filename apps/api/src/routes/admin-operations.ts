import type { FastifyInstance } from 'fastify';
import {
  DeliveryStatus,
  MembershipRole,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  prisma,
} from '@fida/database/client';
import { requirePlatformAdmin } from '../lib/auth.js';

const membershipRoles = Object.values(MembershipRole);
const activeDeliveryStatuses = [
  DeliveryStatus.ASSIGNED,
  DeliveryStatus.AT_PICKUP,
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.AT_DROPOFF,
];

export async function adminOperationsRoutes(app: FastifyInstance) {
  app.get('/v1/admin/operations/summary', { preHandler: requirePlatformAdmin }, async () => {
    const [
      activeBranches,
      pausedBranches,
      activeProducts,
      unavailableProducts,
      activeOrders,
      completedOrders,
      merchantStaff,
      tenantCurrencies,
      completedPaidGroups,
      pendingCashGroups,
    ] = await Promise.all([
      prisma.branch.count({ where: { isActive: true } }),
      prisma.branch.count({ where: { isActive: true, isAcceptingOrders: false } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: true, isAvailable: false } }),
      prisma.order.count({
        where: {
          status: {
            in: [
              OrderStatus.PENDING,
              OrderStatus.ACCEPTED,
              OrderStatus.PREPARING,
              OrderStatus.READY_FOR_PICKUP,
              OrderStatus.PICKED_UP,
              OrderStatus.DELIVERING,
            ],
          },
        },
      }),
      prisma.order.count({ where: { status: OrderStatus.COMPLETED } }),
      prisma.tenantMembership.count(),
      prisma.tenant.findMany({ select: { id: true, currency: true } }),
      prisma.order.groupBy({
        by: ['tenantId'],
        where: { status: OrderStatus.COMPLETED, paymentStatus: PaymentStatus.PAID },
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.order.groupBy({
        by: ['tenantId'],
        where: { paymentMethod: PaymentMethod.CASH, paymentStatus: PaymentStatus.PENDING },
        _count: { _all: true },
        _sum: { total: true },
      }),
    ]);

    const currencyByTenant = new Map(tenantCurrencies.map((tenant) => [tenant.id, tenant.currency]));
    const settlementMap = new Map<string, {
      currency: string;
      completedPaidOrders: number;
      completedPaidValue: number;
      pendingCashOrders: number;
      pendingCashValue: number;
    }>();

    const getSettlement = (tenantId: string) => {
      const currency = currencyByTenant.get(tenantId) ?? 'RWF';
      const existing = settlementMap.get(currency);
      if (existing) return existing;
      const created = {
        currency,
        completedPaidOrders: 0,
        completedPaidValue: 0,
        pendingCashOrders: 0,
        pendingCashValue: 0,
      };
      settlementMap.set(currency, created);
      return created;
    };

    for (const row of completedPaidGroups) {
      const settlement = getSettlement(row.tenantId);
      settlement.completedPaidOrders += row._count._all;
      settlement.completedPaidValue += Number(row._sum.total ?? 0);
    }

    for (const row of pendingCashGroups) {
      const settlement = getSettlement(row.tenantId);
      settlement.pendingCashOrders += row._count._all;
      settlement.pendingCashValue += Number(row._sum.total ?? 0);
    }

    return {
      activeBranches,
      pausedBranches,
      activeProducts,
      unavailableProducts,
      activeOrders,
      completedOrders,
      merchantStaff,
      pendingCashOrders: pendingCashGroups.reduce((sum, row) => sum + row._count._all, 0),
      settlementByCurrency: [...settlementMap.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    };
  });

  app.get('/v1/admin/branches', { preHandler: requirePlatformAdmin }, async (request) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const tenantId = typeof query.tenantId === 'string' ? query.tenantId.trim() : '';
    const requestedState = typeof query.state === 'string' ? query.state.toUpperCase() : '';

    return prisma.branch.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(requestedState === 'ACTIVE' ? { isActive: true } : {}),
        ...(requestedState === 'INACTIVE' ? { isActive: false } : {}),
        ...(requestedState === 'PAUSED' ? { isActive: true, isAcceptingOrders: false } : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        addressLine: true,
        city: true,
        latitude: true,
        longitude: true,
        isActive: true,
        isAcceptingOrders: true,
        createdAt: true,
        updatedAt: true,
        tenant: { select: { id: true, name: true, status: true, currency: true } },
        _count: { select: { memberships: true, orders: true } },
      },
      orderBy: [{ tenant: { name: 'asc' } }, { name: 'asc' }],
      take: 300,
    });
  });

  app.patch('/v1/admin/branches/:branchId', { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { branchId } = request.params as { branchId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const data: { isActive?: boolean; isAcceptingOrders?: boolean } = {};

    if ('isActive' in body) {
      if (typeof body.isActive !== 'boolean') {
        return reply.code(400).send({ error: 'invalid_is_active' });
      }
      data.isActive = body.isActive;
      if (!body.isActive) data.isAcceptingOrders = false;
    }

    if ('isAcceptingOrders' in body) {
      if (typeof body.isAcceptingOrders !== 'boolean') {
        return reply.code(400).send({ error: 'invalid_is_accepting_orders' });
      }
      data.isAcceptingOrders = body.isAcceptingOrders;
    }

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({ error: 'branch_update_required' });
    }

    const existing = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, isActive: true } });
    if (!existing) return reply.code(404).send({ error: 'branch_not_found' });

    if (data.isAcceptingOrders === true && data.isActive !== true && !existing.isActive) {
      return reply.code(409).send({ error: 'inactive_branch_cannot_accept_orders' });
    }

    return prisma.branch.update({
      where: { id: branchId },
      data,
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        addressLine: true,
        isActive: true,
        isAcceptingOrders: true,
        updatedAt: true,
        tenant: { select: { id: true, name: true, status: true, currency: true } },
        _count: { select: { memberships: true, orders: true } },
      },
    });
  });

  app.get('/v1/admin/memberships', { preHandler: requirePlatformAdmin }, async (request) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const tenantId = typeof query.tenantId === 'string' ? query.tenantId.trim() : '';
    const search = typeof query.q === 'string' ? query.q.trim() : '';

    return prisma.tenantMembership.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(search
          ? {
              OR: [
                { tenant: { is: { name: { contains: search, mode: 'insensitive' } } } },
                { user: { is: { email: { contains: search, mode: 'insensitive' } } } },
                { user: { is: { phone: { contains: search } } } },
                { user: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
                { user: { is: { lastName: { contains: search, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        role: true,
        branchId: true,
        createdAt: true,
        tenant: { select: { id: true, name: true, status: true } },
        branch: { select: { id: true, name: true, city: true, isActive: true } },
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: [{ tenant: { name: 'asc' } }, { createdAt: 'asc' }],
      take: 300,
    });
  });

  app.patch('/v1/admin/memberships/:membershipId', { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { membershipId } = request.params as { membershipId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;

    const membership = await prisma.tenantMembership.findUnique({
      where: { id: membershipId },
      select: { id: true, tenantId: true, role: true, branchId: true },
    });
    if (!membership) return reply.code(404).send({ error: 'membership_not_found' });

    const data: { role?: MembershipRole; branchId?: string | null } = {};

    if ('role' in body) {
      const requestedRole = typeof body.role === 'string' ? body.role.toUpperCase() : '';
      if (!membershipRoles.includes(requestedRole as MembershipRole)) {
        return reply.code(400).send({ error: 'invalid_membership_role', allowed: membershipRoles });
      }
      data.role = requestedRole as MembershipRole;

      if (membership.role === MembershipRole.OWNER && data.role !== MembershipRole.OWNER) {
        const otherOwners = await prisma.tenantMembership.count({
          where: { tenantId: membership.tenantId, role: MembershipRole.OWNER, id: { not: membership.id } },
        });
        if (otherOwners === 0) {
          return reply.code(409).send({ error: 'last_owner_required' });
        }
      }
    }

    if ('branchId' in body) {
      if (body.branchId === null || body.branchId === '') {
        data.branchId = null;
      } else if (typeof body.branchId === 'string') {
        const branch = await prisma.branch.findFirst({
          where: { id: body.branchId, tenantId: membership.tenantId },
          select: { id: true },
        });
        if (!branch) return reply.code(400).send({ error: 'invalid_membership_branch' });
        data.branchId = branch.id;
      } else {
        return reply.code(400).send({ error: 'invalid_membership_branch' });
      }
    }

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({ error: 'membership_update_required' });
    }

    return prisma.tenantMembership.update({
      where: { id: membership.id },
      data,
      select: {
        id: true,
        role: true,
        branchId: true,
        createdAt: true,
        tenant: { select: { id: true, name: true, status: true } },
        branch: { select: { id: true, name: true, city: true, isActive: true } },
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
    });
  });

  app.patch('/v1/admin/drivers/:driverId/state', { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { driverId } = request.params as { driverId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        user: { select: { id: true, isActive: true } },
      },
    });
    if (!driver) return reply.code(404).send({ error: 'driver_not_found' });

    let isOnline = typeof body.isOnline === 'boolean' ? body.isOnline : driver.isOnline;
    let isAvailable = typeof body.isAvailable === 'boolean' ? body.isAvailable : driver.isAvailable;

    if (!driver.user.isActive) {
      isOnline = false;
      isAvailable = false;
    }
    if (!isOnline) isAvailable = false;

    if (isAvailable) {
      const activeDelivery = await prisma.delivery.findFirst({
        where: { driverId, status: { in: activeDeliveryStatuses } },
        select: { id: true },
      });
      if (activeDelivery) {
        return reply.code(409).send({ error: 'active_delivery', message: 'Driver has an active delivery.' });
      }
    }

    return prisma.driver.update({
      where: { id: driverId },
      data: { isOnline, isAvailable, lastSeenAt: new Date() },
      include: {
        user: {
          select: { id: true, email: true, phone: true, firstName: true, lastName: true, isActive: true },
        },
        _count: { select: { deliveries: true } },
      },
    });
  });
}
