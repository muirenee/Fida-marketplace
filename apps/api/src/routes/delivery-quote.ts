import type { FastifyInstance } from 'fastify';
import { TenantStatus, prisma } from '@fida/database/client';
import { authenticate } from '../lib/auth.js';
import { quoteBranchDelivery } from '../lib/delivery-pricing.js';

export async function deliveryQuoteRoutes(app: FastifyInstance) {
  app.get('/v1/customer/delivery-quote/location', { preHandler: authenticate }, async (request, reply) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const branchId = typeof query.branchId === 'string' ? query.branchId : '';
    const latitude = Number(query.latitude);
    const longitude = Number(query.longitude);

    if (!branchId || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return reply.code(400).send({ error: 'branch_and_location_required' });
    }

    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        isActive: true,
        isAcceptingOrders: true,
        deliveryEnabled: true,
        tenant: { status: TenantStatus.ACTIVE, isAcceptingOrders: true },
      },
      select: { id: true, tenant: { select: { id: true, currency: true } } },
    });
    if (!branch) return reply.code(404).send({ error: 'branch_not_found' });

    const quote = await quoteBranchDelivery(branch.id, latitude, longitude);
    if (!quote) {
      return reply.code(409).send({ error: 'outside_delivery_area', message: 'This location is outside the merchant delivery area.' });
    }

    return {
      branchId: branch.id,
      tenantId: branch.tenant.id,
      currency: branch.tenant.currency,
      distanceKm: quote.distanceKm,
      deliveryPrice: quote.fee,
      freeDelivery: quote.fee.isZero(),
    };
  });
}
