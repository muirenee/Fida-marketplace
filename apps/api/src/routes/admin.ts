import type { FastifyInstance } from 'fastify';
import { TenantStatus, prisma } from '@fida/database/client';
import { requirePlatformAdmin } from '../lib/auth.js';

const manageableStatuses = [
  TenantStatus.PENDING,
  TenantStatus.ACTIVE,
  TenantStatus.SUSPENDED,
  TenantStatus.CLOSED,
];

export async function adminRoutes(app: FastifyInstance) {
  app.get('/v1/admin/overview', { preHandler: requirePlatformAdmin }, async () => {
    const [tenants, pendingTenants, users, drivers, onlineDrivers, orders] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: TenantStatus.PENDING } }),
      prisma.user.count(),
      prisma.driver.count(),
      prisma.driver.count({ where: { isOnline: true } }),
      prisma.order.count(),
    ]);

    return { tenants, pendingTenants, users, drivers, onlineDrivers, orders };
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
        driver: { select: { id: true, isOnline: true, isAvailable: true, lastSeenAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  app.patch('/v1/admin/users/:userId/active', { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    if (typeof body.isActive !== 'boolean') {
      return reply.code(400).send({ error: 'is_active_required' });
    }

    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!existing) return reply.code(404).send({ error: 'user_not_found' });

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive: body.isActive },
      select: { id: true, email: true, phone: true, firstName: true, lastName: true, isActive: true },
    });

    if (!body.isActive) {
      await prisma.driver.updateMany({
        where: { userId },
        data: { isOnline: false, isAvailable: false },
      });
      await prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return user;
  });

  app.get('/v1/admin/drivers', { preHandler: requirePlatformAdmin }, async () => {
    return prisma.driver.findMany({
      include: {
        user: {
          select: { id: true, email: true, phone: true, firstName: true, lastName: true, isActive: true },
        },
        _count: { select: { deliveries: true } },
      },
      orderBy: { lastSeenAt: 'desc' },
    });
  });

  app.post('/v1/admin/drivers', { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const userId = typeof body.userId === 'string' ? body.userId : '';
    if (!userId) return reply.code(400).send({ error: 'user_id_required' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, driver: { select: { id: true } } },
    });

    if (!user) return reply.code(404).send({ error: 'user_not_found' });
    if (!user.isActive) return reply.code(409).send({ error: 'user_inactive' });
    if (user.driver) return reply.code(409).send({ error: 'driver_already_exists', driverId: user.driver.id });

    const driver = await prisma.driver.create({
      data: { userId },
      include: {
        user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
      },
    });

    return reply.code(201).send(driver);
  });

  app.get('/v1/admin/tenants', { preHandler: requirePlatformAdmin }, async (request) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const requestedStatus = typeof query.status === 'string' ? query.status.toUpperCase() : null;
    const status = manageableStatuses.includes(requestedStatus as TenantStatus)
      ? (requestedStatus as TenantStatus)
      : undefined;

    return prisma.tenant.findMany({
      where: status ? { status } : undefined,
      include: {
        branches: { select: { id: true, name: true, city: true, isActive: true } },
        _count: { select: { memberships: true, products: true, orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.patch(
    '/v1/admin/tenants/:tenantId/status',
    { preHandler: requirePlatformAdmin },
    async (request, reply) => {
      const params = request.params as { tenantId: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const requestedStatus = typeof body.status === 'string' ? body.status.toUpperCase() : '';

      if (!manageableStatuses.includes(requestedStatus as TenantStatus)) {
        return reply.code(400).send({
          error: 'invalid_status',
          allowed: manageableStatuses,
        });
      }

      const existing = await prisma.tenant.findUnique({ where: { id: params.tenantId } });
      if (!existing) {
        return reply.code(404).send({ error: 'tenant_not_found' });
      }

      const status = requestedStatus as TenantStatus;
      return prisma.tenant.update({
        where: { id: params.tenantId },
        data: {
          status,
          activatedAt:
            status === TenantStatus.ACTIVE && !existing.activatedAt ? new Date() : existing.activatedAt,
        },
      });
    },
  );
}
