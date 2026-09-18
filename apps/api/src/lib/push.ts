import type { FastifyBaseLogger } from 'fastify';
import { DeliveryOperatorType, FulfillmentType, LogisticsMode, OrderStatus, prisma } from '@fida/database/client';
import { fcmConfigured, sendFcmMessage } from './fcm.js';

export type PushApp = 'CUSTOMER' | 'MERCHANT' | 'DRIVER';

type PushPayload = {
  title: string;
  body: string;
  type: string;
  orderId?: string;
  orderNumber?: string;
  status?: string;
};

function payloadData(payload: PushPayload) {
  return Object.fromEntries(
    Object.entries({
      type: payload.type,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      status: payload.status,
    }).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

export async function sendPushToUsers(userIds: string[], app: PushApp, payload: PushPayload, logger?: FastifyBaseLogger) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) return { devices: 0, sent: 0 };

  const devices = await prisma.pushDevice.findMany({
    where: { userId: { in: uniqueUserIds }, app, isActive: true },
    select: { id: true, token: true },
  });

  if (devices.length === 0) return { devices: 0, sent: 0 };

  let sent = 0;
  await Promise.all(devices.map(async (device) => {
    try {
      const result = await sendFcmMessage({
        token: device.token,
        title: payload.title,
        body: payload.body,
        data: payloadData(payload),
      });
      if (result.sent) {
        sent += 1;
        await prisma.pushDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
      } else if (!result.skipped && result.invalidToken) {
        await prisma.pushDevice.update({ where: { id: device.id }, data: { isActive: false } });
      }
    } catch (error) {
      logger?.warn({ err: error, pushDeviceId: device.id }, 'push notification send failed');
    }
  }));

  return { devices: devices.length, sent };
}

async function merchantUserIds(tenantId: string) {
  const memberships = await prisma.tenantMembership.findMany({
    where: { tenantId, user: { isActive: true } },
    select: { userId: true },
  });
  return memberships.map((row) => row.userId);
}

async function eligibleDriverUserIds(order: {
  tenantId: string;
  branchId: string;
  branch: { logisticsMode: LogisticsMode };
}) {
  const operatorIds: string[] = [];

  if (order.branch.logisticsMode === LogisticsMode.MERCHANT || order.branch.logisticsMode === LogisticsMode.HYBRID) {
    const merchantOperator = await prisma.deliveryOperator.findFirst({
      where: { type: DeliveryOperatorType.MERCHANT, tenantId: order.tenantId, isActive: true },
      select: { id: true },
    });
    if (merchantOperator) operatorIds.push(merchantOperator.id);
  }

  if (order.branch.logisticsMode === LogisticsMode.FIDA || order.branch.logisticsMode === LogisticsMode.HYBRID) {
    const fidaOperator = await prisma.deliveryOperator.findFirst({
      where: { type: DeliveryOperatorType.FIDA, tenantId: null, isActive: true },
      select: { id: true },
    });
    if (fidaOperator) operatorIds.push(fidaOperator.id);
  }

  if (operatorIds.length === 0) return [];
  const drivers = await prisma.driver.findMany({
    where: {
      operatorId: { in: operatorIds },
      isActive: true,
      isOnline: true,
      isAvailable: true,
      OR: [{ branchId: null }, { branchId: order.branchId }],
      user: { isActive: true },
    },
    select: { userId: true },
  });
  return drivers.map((row) => row.userId);
}

function customerOrderStatusMessage(status: OrderStatus, fulfillmentType: FulfillmentType, merchantName: string) {
  switch (status) {
    case OrderStatus.ACCEPTED:
      return { title: 'Order accepted', body: `${merchantName} accepted your order.` };
    case OrderStatus.PREPARING:
      return { title: 'Order being prepared', body: `${merchantName} is preparing your order.` };
    case OrderStatus.READY_FOR_PICKUP:
      return fulfillmentType === FulfillmentType.PICKUP
        ? { title: 'Ready for pickup', body: `Your order from ${merchantName} is ready for pickup.` }
        : { title: 'Ready for delivery', body: `Your order from ${merchantName} is ready for a driver.` };
    case OrderStatus.PICKED_UP:
      return { title: 'Order picked up', body: 'Your driver picked up the order.' };
    case OrderStatus.DELIVERING:
      return { title: 'Driver arriving', body: 'Your driver is approaching the delivery point.' };
    case OrderStatus.COMPLETED:
      return fulfillmentType === FulfillmentType.PICKUP
        ? { title: 'Order completed', body: `Your order from ${merchantName} is complete.` }
        : { title: 'Order delivered', body: 'Your delivery has been completed.' };
    case OrderStatus.REJECTED:
      return { title: 'Order not accepted', body: `${merchantName} could not accept your order.` };
    case OrderStatus.CANCELLED:
      return { title: 'Order cancelled', body: 'Your order has been cancelled.' };
    default:
      return null;
  }
}

async function processOrder(orderId: string, logger?: FastifyBaseLogger) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      tenant: { select: { name: true } },
      branch: { select: { logisticsMode: true } },
      delivery: { select: { id: true, status: true, driverId: true, updatedAt: true, driver: { select: { userId: true } } } },
    },
  });
  if (!order) return;

  const state = await prisma.pushOrderState.findUnique({ where: { orderId: order.id } });
  const currentDeliveryStatus = order.delivery?.status ?? null;
  const currentDriverId = order.delivery?.driverId ?? null;

  if (!state) {
    await prisma.pushOrderState.create({
      data: {
        orderId: order.id,
        orderStatus: order.status,
        deliveryStatus: currentDeliveryStatus,
        driverId: currentDriverId,
      },
    });

    const ageMs = Date.now() - order.createdAt.getTime();
    if (ageMs <= 10 * 60_000) {
      const merchantUsers = await merchantUserIds(order.tenantId);
      await sendPushToUsers(merchantUsers, 'MERCHANT', {
        title: 'New order',
        body: `${order.orderNumber} has been placed.`,
        type: 'NEW_ORDER',
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
      }, logger);

      if (order.status === OrderStatus.READY_FOR_PICKUP && order.fulfillmentType === FulfillmentType.DELIVERY) {
        const driverUsers = await eligibleDriverUserIds(order);
        await sendPushToUsers(driverUsers, 'DRIVER', {
          title: 'Delivery available',
          body: `${order.orderNumber} is ready for pickup.`,
          type: 'DELIVERY_OFFER',
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
        }, logger);
      }
    }
    return;
  }

  if (state.orderStatus !== order.status) {
    const customerMessage = customerOrderStatusMessage(order.status, order.fulfillmentType, order.tenant.name);
    if (customerMessage) {
      await sendPushToUsers([order.customerId], 'CUSTOMER', {
        ...customerMessage,
        type: 'ORDER_STATUS',
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
      }, logger);
    }

    if (order.status === OrderStatus.CANCELLED) {
      const merchantUsers = await merchantUserIds(order.tenantId);
      await sendPushToUsers(merchantUsers, 'MERCHANT', {
        title: 'Order cancelled',
        body: `${order.orderNumber} was cancelled by the customer.`,
        type: 'ORDER_CANCELLED',
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
      }, logger);
    }

    if (order.status === OrderStatus.READY_FOR_PICKUP && order.fulfillmentType === FulfillmentType.DELIVERY) {
      const driverUsers = await eligibleDriverUserIds(order);
      await sendPushToUsers(driverUsers, 'DRIVER', {
        title: 'Delivery available',
        body: `${order.orderNumber} is ready for pickup.`,
        type: 'DELIVERY_OFFER',
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
      }, logger);
    }
  }

  if (state.driverId !== currentDriverId && currentDriverId && order.delivery?.driver?.userId) {
    await sendPushToUsers([order.customerId], 'CUSTOMER', {
      title: 'Driver assigned',
      body: `A driver has accepted delivery for ${order.orderNumber}.`,
      type: 'DRIVER_ASSIGNED',
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: currentDeliveryStatus ?? undefined,
    }, logger);
  }

  await prisma.pushOrderState.update({
    where: { orderId: order.id },
    data: {
      orderStatus: order.status,
      deliveryStatus: currentDeliveryStatus,
      driverId: currentDriverId,
    },
  });
}

let workerStarted = false;
let workerBusy = false;

export function startPushNotificationWorker(logger?: FastifyBaseLogger) {
  if (workerStarted) return;
  workerStarted = true;

  const intervalMs = Math.max(2_000, Number(process.env.PUSH_WORKER_INTERVAL_MS ?? 5_000));
  const run = async () => {
    if (workerBusy) return;
    workerBusy = true;
    try {
      const cutoff = new Date(Date.now() - 15 * 60_000);
      const orders = await prisma.order.findMany({
        where: {
          OR: [
            { updatedAt: { gte: cutoff } },
            { delivery: { is: { updatedAt: { gte: cutoff } } } },
          ],
        },
        select: { id: true },
        orderBy: { updatedAt: 'asc' },
        take: 500,
      });
      for (const order of orders) await processOrder(order.id, logger);
    } catch (error) {
      logger?.error({ err: error }, 'push notification worker failed');
    } finally {
      workerBusy = false;
    }
  };

  setTimeout(() => void run(), 2_000);
  const timer = setInterval(() => void run(), intervalMs);
  timer.unref();
  logger?.info({ fcmConfigured: fcmConfigured(), intervalMs }, 'push notification worker started');
}
