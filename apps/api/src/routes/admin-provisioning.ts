import type { FastifyInstance } from 'fastify';
import { MembershipRole, prisma } from '@fida/database/client';
import { requirePlatformAdmin } from '../lib/auth.js';

const membershipRoles = Object.values(MembershipRole);

export async function adminProvisioningRoutes(app: FastifyInstance) {
  app.post('/v1/admin/branches', { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() || null : null;
    const city = typeof body.city === 'string' ? body.city.trim() || null : null;
    const addressLine = typeof body.addressLine === 'string' ? body.addressLine.trim() || null : null;
    const isAcceptingOrders = typeof body.isAcceptingOrders === 'boolean' ? body.isAcceptingOrders : true;

    if (!tenantId || name.length < 2) {
      return reply.code(400).send({ error: 'invalid_branch', message: 'Merchant and branch name are required.' });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, status: true } });
    if (!tenant) return reply.code(404).send({ error: 'tenant_not_found' });

    if (code) {
      const existingCode = await prisma.branch.findFirst({ where: { tenantId, code }, select: { id: true } });
      if (existingCode) return reply.code(409).send({ error: 'branch_code_in_use' });
    }

    const branch = await prisma.branch.create({
      data: {
        tenantId,
        name,
        code,
        city,
        addressLine,
        isAcceptingOrders,
      },
      select: {
        id: true,
        name: true,
        code: true,
        addressLine: true,
        city: true,
        isActive: true,
        isAcceptingOrders: true,
        createdAt: true,
        tenant: { select: { id: true, name: true, status: true, currency: true } },
        _count: { select: { memberships: true, orders: true } },
      },
    });

    return reply.code(201).send(branch);
  });

  app.post('/v1/admin/memberships', { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const requestedRole = typeof body.role === 'string' ? body.role.toUpperCase() : '';
    const branchId = body.branchId === null || body.branchId === ''
      ? null
      : typeof body.branchId === 'string'
        ? body.branchId.trim()
        : undefined;

    if (!tenantId || !userId) {
      return reply.code(400).send({ error: 'tenant_and_user_required' });
    }
    if (!membershipRoles.includes(requestedRole as MembershipRole)) {
      return reply.code(400).send({ error: 'invalid_membership_role', allowed: membershipRoles });
    }
    if (branchId === undefined) {
      return reply.code(400).send({ error: 'invalid_membership_branch' });
    }

    const [tenant, user, existing] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, status: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true } }),
      prisma.tenantMembership.findUnique({ where: { tenantId_userId: { tenantId, userId } }, select: { id: true } }),
    ]);

    if (!tenant) return reply.code(404).send({ error: 'tenant_not_found' });
    if (!user) return reply.code(404).send({ error: 'user_not_found' });
    if (!user.isActive) return reply.code(409).send({ error: 'user_inactive' });
    if (existing) return reply.code(409).send({ error: 'membership_already_exists', membershipId: existing.id });

    if (branchId) {
      const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId }, select: { id: true } });
      if (!branch) return reply.code(400).send({ error: 'invalid_membership_branch' });
    }

    const membership = await prisma.tenantMembership.create({
      data: {
        tenantId,
        userId,
        role: requestedRole as MembershipRole,
        branchId,
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
    });

    return reply.code(201).send(membership);
  });
}
