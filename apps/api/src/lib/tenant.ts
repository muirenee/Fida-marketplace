import type { FastifyReply, FastifyRequest } from 'fastify';
import { MembershipRole, prisma } from '@fida/database/client';
import { authenticate } from './auth.js';

export function requireTenant(allowedRoles?: MembershipRole[]) {
  return async function tenantGuard(request: FastifyRequest, reply: FastifyReply) {
    await authenticate(request, reply);
    if (reply.sent) return;

    const header = request.headers['x-tenant-id'];
    const tenantId = Array.isArray(header) ? header[0] : header;

    if (!tenantId) {
      return reply.code(400).send({
        error: 'tenant_required',
        message: 'x-tenant-id header is required for merchant operations.',
      });
    }

    const membership = await prisma.tenantMembership.findFirst({
      where: {
        tenantId,
        userId: request.authUser!.id,
        isActive: true,
      },
      include: {
        tenant: {
          select: { id: true, name: true, status: true },
        },
      },
    });

    if (!membership) {
      return reply.code(403).send({ error: 'forbidden', message: 'You are not a member of this merchant.' });
    }

    if (membership.tenant.status !== 'ACTIVE') {
      return reply.code(403).send({
        error: 'tenant_unavailable',
        message: `Merchant account is ${membership.tenant.status.toLowerCase()}.`,
      });
    }

    if (allowedRoles && !allowedRoles.includes(membership.role)) {
      return reply.code(403).send({ error: 'forbidden', message: 'Your merchant role cannot perform this action.' });
    }

    if (membership.role === 'KITCHEN_CREW') {
      const route = request.routeOptions.url;
      const permitted = request.method === 'GET'
        ? ['/v1/merchant/context', '/v1/merchant/orders', '/v1/merchant/products', '/v1/merchant/categories', '/v1/merchant/fulfillment'].includes(route ?? '')
        : request.method === 'PATCH' && ['/v1/merchant/products/:id/stock', '/v1/merchant/orders/:orderId/status'].includes(route ?? '');
      if (!permitted) return reply.code(403).send({error:'forbidden',message:'Kitchen access is limited to orders and inventory.'});
    }
    request.tenantContext = {
      tenantId: membership.tenant.id,
      tenantName: membership.tenant.name,
      tenantStatus: membership.tenant.status,
      role: membership.role,
      branchId: membership.branchId,
    };
  };
}

export const merchantWriteRoles: MembershipRole[] = [
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
];
