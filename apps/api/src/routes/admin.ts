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
    const [tenants, pendingTenants, users, drivers, orders] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: TenantStatus.PENDING } }),
      prisma.user.count(),
      prisma.driver.count(),
      prisma.order.count(),
    ]);

    return { tenants, pendingTenants, users, drivers, orders };
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
