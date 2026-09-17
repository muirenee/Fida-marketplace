import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  DeliveryOperatorType,
  DeliveryStatus,
  FulfillmentType,
  LogisticsMode,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  prisma,
} from '@fida/database/client';
import { authenticate } from '../lib/auth.js';
import { haversineKm } from '../lib/delivery-pricing.js';

async function requireDriver(request: FastifyRequest, reply: FastifyReply) {
  await authenticate(request, reply);
  if (reply.sent) return null;

  const driver = await prisma.driver.findUnique({
    where: { userId: request.authUser!.id },
    include: {
      user: { select: { firstName: true, lastName: true, phone: true, email: true } },
      operator: true,
      branch: { select: { id: true, name: true, city: true } },
    },
  });

  if (!driver || !driver.isActive || !driver.operatorId || !driver.operator?.isActive) {
    reply.code(403).send({
      error: 'driver_not_enrolled',
      message: 'This account is not enrolled by an active merchant delivery operation.',
    });
    return null;
  }

  return driver;
}

function availableScope(driver: NonNullable<Awaited<ReturnType<typeof requireDriver>>>): Prisma.DeliveryWhereInput | null {
  if (!driver.operator) return null;
  const base: Prisma.DeliveryWhereInput = {
    driverId: null,
    status: DeliveryStatus.UNASSIGNED,
    order: {
      status: OrderStatus.READY_FOR_PICKUP,
      fulfillmentType: FulfillmentType.DELIVERY,
    },
  };

  if (driver.operator.type === DeliveryOperatorType.MERCHANT && driver.operator.tenantId) {
    return {
      ...base,
      order: {
        status: OrderStatus.READY_FOR_PICKUP,
        fulfillmentType: FulfillmentType.DELIVERY,
        tenantId: driver.operator.tenantId,
        branch: { logisticsMode: { in: [LogisticsMode.MERCHANT, LogisticsMode.HYBRID] } },
        ...(driver.branchId ? { branchId: driver.branchId } : {}),
      },
    };
  }

  if (driver.operator.type === DeliveryOperatorType.FIDA) {
    return {
      ...base,
      order: {
        status: OrderStatus.READY_FOR_PICKUP,
        fulfillmentType: FulfillmentType.DELIVERY,
        branch: { logisticsMode: { in: [LogisticsMode.FIDA, LogisticsMode.HYBRID] } },
      },
    };
  }

  return null;
}

const deliveryTransitions: Partial<Record<DeliveryStatus, DeliveryStatus[]>> = {
  [DeliveryStatus.ASSIGNED]: [DeliveryStatus.AT_PICKUP],
  [DeliveryStatus.AT_PICKUP]: [DeliveryStatus.PICKED_UP],
  [DeliveryStatus.PICKED_UP]: [DeliveryStatus.AT_DROPOFF],
  [DeliveryStatus.AT_DROPOFF]: [DeliveryStatus.DELIVERED],
};

export async function driverRoutes(app: FastifyInstance) {
  app.get('/v1/driver/profile', async (request, reply) => {
    const driver = await requireDriver(request, reply);
    if (!driver) return;
    return driver;
  });

  app.patch('/v1/driver/availability', async (request, reply) => {
    const driver = await requireDriver(request, reply);
    if (!driver) return;

    const body = (request.body ?? {}) as Record<string, unknown>;
    const isOnline = typeof body.isOnline === 'boolean' ? body.isOnline : driver.isOnline;
    const requestedAvailable = typeof body.isAvailable === 'boolean' ? body.isAvailable : driver.isAvailable;
    const isAvailable = isOnline ? requestedAvailable : false;

    const activeDelivery = await prisma.delivery.findFirst({
      where: {
        driverId: driver.id,
        status: { in: [DeliveryStatus.ASSIGNED, DeliveryStatus.AT_PICKUP, DeliveryStatus.PICKED_UP, DeliveryStatus.AT_DROPOFF] },
      },
      select: { id: true },
    });

    if (activeDelivery && isAvailable) {
      return reply.code(409).send({ error: 'active_delivery', message: 'Complete the active delivery before becoming available for another order.' });
    }

    return prisma.driver.update({
      where: { id: driver.id },
      data: { isOnline, isAvailable, lastSeenAt: new Date() },
      include: { operator: true, branch: true },
    });
  });

  app.patch('/v1/driver/location', async (request, reply) => {
    const driver = await requireDriver(request, reply);
    if (!driver) return;

    const body = (request.body ?? {}) as Record<string, unknown>;
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return reply.code(400).send({ error: 'invalid_location' });
    }

    return prisma.driver.update({
      where: { id: driver.id },
      data: { latitude, longitude, lastSeenAt: new Date() },
      select: { id: true, latitude: true, longitude: true, lastSeenAt: true },
    });
  });

  app.get('/v1/driver/deliveries/available', async (request, reply) => {
    const driver = await requireDriver(request, reply);
    if (!driver) return;
    if (!driver.isOnline || !driver.isAvailable) {
      return reply.code(409).send({ error: 'driver_unavailable', message: 'Driver must be online and available.' });
    }

    const scope = availableScope(driver);
    if (!scope) return reply.code(403).send({ error: 'driver_scope_unavailable' });

    const deliveries = await prisma.delivery.findMany({
      where: scope,
      include: {
        order: {
          include: {
            tenant: { select: { id: true, name: true, slug: true } },
            branch: { select: { id: true, name: true, addressLine: true, city: true, latitude: true, longitude: true } },
            items: { select: { id: true, productName: true, quantity: true } },
          },
        },
      },
      orderBy: { order: { createdAt: 'asc' } },
      take: 50,
    });

    const driverLat = driver.latitude ? Number(driver.latitude) : null;
    const driverLon = driver.longitude ? Number(driver.longitude) : null;

    return deliveries.map((delivery) => {
      const branchLat = delivery.order.branch.latitude ? Number(delivery.order.branch.latitude) : null;
      const branchLon = delivery.order.branch.longitude ? Number(delivery.order.branch.longitude) : null;
      const distanceKm =
        driverLat !== null && driverLon !== null && branchLat !== null && branchLon !== null
          ? Number(haversineKm(driverLat, driverLon, branchLat, branchLon).toFixed(1))
          : null;
      return { ...delivery, distanceToPickupKm: distanceKm };
    });
  });

  app.get('/v1/driver/deliveries/current', async (request, reply) => {
    const driver = await requireDriver(request, reply);
    if (!driver) return;

    return prisma.delivery.findFirst({
      where: {
        driverId: driver.id,
        status: { in: [DeliveryStatus.ASSIGNED, DeliveryStatus.AT_PICKUP, DeliveryStatus.PICKED_UP, DeliveryStatus.AT_DROPOFF] },
      },
      include: {
        order: {
          include: {
            tenant: { select: { id: true, name: true, slug: true } },
            branch: true,
            customer: { select: { firstName: true, lastName: true, phone: true } },
            items: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  });

  app.post('/v1/driver/deliveries/:deliveryId/claim', async (request, reply) => {
    const driver = await requireDriver(request, reply);
    if (!driver) return;
    const { deliveryId } = request.params as { deliveryId: string };
    if (!driver.isOnline || !driver.isAvailable) return reply.code(409).send({ error: 'driver_unavailable' });

    const existingActive = await prisma.delivery.findFirst({
      where: {
        driverId: driver.id,
        status: { in: [DeliveryStatus.ASSIGNED, DeliveryStatus.AT_PICKUP, DeliveryStatus.PICKED_UP, DeliveryStatus.AT_DROPOFF] },
      },
      select: { id: true },
    });
    if (existingActive) return reply.code(409).send({ error: 'active_delivery' });

    const scope = availableScope(driver);
    if (!scope) return reply.code(403).send({ error: 'driver_scope_unavailable' });
    const delivery = await prisma.delivery.findFirst({ where: { AND: [{ id: deliveryId }, scope] }, select: { id: true } });
    if (!delivery) return reply.code(409).send({ error: 'delivery_unavailable' });

    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.delivery.updateMany({
        where: { id: delivery.id, driverId: null, status: DeliveryStatus.UNASSIGNED },
        data: { driverId: driver.id, operatorId: driver.operatorId, status: DeliveryStatus.ASSIGNED, assignedAt: new Date() },
      });
      if (claimed.count !== 1) return null;

      await tx.driver.update({ where: { id: driver.id }, data: { isAvailable: false, lastSeenAt: new Date() } });
      return tx.delivery.findUnique({
        where: { id: delivery.id },
        include: { order: { include: { tenant: true, branch: true, items: true } }, operator: true },
      });
    });

    if (!result) return reply.code(409).send({ error: 'delivery_already_claimed' });
    return result;
  });

  app.patch('/v1/driver/deliveries/:deliveryId/status', async (request, reply) => {
    const driver = await requireDriver(request, reply);
    if (!driver) return;
    const { deliveryId } = request.params as { deliveryId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const requestedStatus = typeof body.status === 'string' ? body.status.toUpperCase() : '';

    if (!Object.values(DeliveryStatus).includes(requestedStatus as DeliveryStatus)) {
      return reply.code(400).send({ error: 'invalid_delivery_status', allowed: Object.values(DeliveryStatus) });
    }

    const delivery = await prisma.delivery.findFirst({
      where: { id: deliveryId, driverId: driver.id },
      select: { id: true, orderId: true, status: true },
    });
    if (!delivery) return reply.code(404).send({ error: 'delivery_not_found' });

    const nextStatus = requestedStatus as DeliveryStatus;
    const allowed = deliveryTransitions[delivery.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      return reply.code(409).send({ error: 'invalid_delivery_transition', currentStatus: delivery.status, allowed });
    }

    const now = new Date();
    const orderStatus =
      nextStatus === DeliveryStatus.PICKED_UP
        ? OrderStatus.PICKED_UP
        : nextStatus === DeliveryStatus.AT_DROPOFF
          ? OrderStatus.DELIVERING
          : nextStatus === DeliveryStatus.DELIVERED
            ? OrderStatus.COMPLETED
            : null;

    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.delivery.update({
        where: { id: delivery.id },
        data: {
          status: nextStatus,
          ...(nextStatus === DeliveryStatus.PICKED_UP ? { pickedUpAt: now } : {}),
          ...(nextStatus === DeliveryStatus.DELIVERED ? { deliveredAt: now } : {}),
        },
      });

      if (orderStatus) await tx.order.update({ where: { id: delivery.orderId }, data: { status: orderStatus } });

      if (nextStatus === DeliveryStatus.DELIVERED) {
        await tx.order.updateMany({
          where: { id: delivery.orderId, paymentMethod: PaymentMethod.CASH, paymentStatus: PaymentStatus.PENDING },
          data: { paymentStatus: PaymentStatus.PAID },
        });
        await tx.driver.update({ where: { id: driver.id }, data: { isAvailable: driver.isOnline, lastSeenAt: now } });
      }
      return changed;
    });

    return updated;
  });
}
