import type { FastifyInstance } from 'fastify';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { Prisma, prisma } from '@fida/database/client';

export async function enqueueOrder(tx: Prisma.TransactionClient, orderId: string, status: string) {
  await tx.notificationEvent.upsert({ where: { eventKey: `${orderId}:${status}` }, update: {}, create: { eventKey: `${orderId}:${status}`, orderId, status } });
}
export function pushConfigured() { return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS); }
function messaging() {
  if (!getApps().length) initializeApp({ credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) : applicationDefault() });
  return getMessaging();
}
export function startNotificationWorker(app: FastifyInstance) {
  let running = false;
  const timer = setInterval(async () => {
    if (running || !pushConfigured()) return;
    running = true;
    try {
      const events = await prisma.notificationEvent.findMany({ where: { sentAt: null, attempts: { lt: 10 }, nextAttemptAt: { lte: new Date() } }, take: 20, orderBy: { createdAt: 'asc' } });
      for (const event of events) {
        const claimed = await prisma.notificationEvent.updateMany({ where: { id: event.id, sentAt: null, nextAttemptAt: event.nextAttemptAt }, data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** event.attempts)) } });
        if (!claimed.count) continue;
        try {
          const order = await prisma.order.findUnique({ where: { id: event.orderId }, include: { tenant: { include: { memberships: true } }, branch: true, delivery: { include: { driver: true } } } });
          if (!order) { await prisma.notificationEvent.update({ where: { id: event.id }, data: { sentAt: new Date() } }); continue; }
          const recipients: { userId: string | { in: string[] }; app: string }[] = [
            { userId: order.customerId, app: 'customer' },
            { userId: { in: order.tenant.memberships.filter(m => m.isActive && (!m.branchId || m.branchId === order.branchId)).map(m => m.userId) }, app: 'merchant' },
          ];
          if (order.delivery?.driver) recipients.push({ userId: order.delivery.driver.userId, app: 'driver' });
          if (event.status === 'READY_FOR_PICKUP' && order.fulfillmentType === 'DELIVERY') {
            const drivers = await prisma.driver.findMany({ where: { isActive: true, isOnline: true, isAvailable: true, user: { isActive: true }, AND: [
              { OR: [{ branchId: null }, { branchId: order.branchId }] },
              { OR: [ ...(order.branch.logisticsMode !== 'FIDA' ? [{ operator: { tenantId: order.tenantId, isActive: true } }] : []), ...(order.branch.logisticsMode !== 'MERCHANT' ? [{ operator: { type: 'FIDA' as const, isActive: true } }] : []) ] },
            ] }, select: { userId: true } });
            recipients.push({ userId: { in: drivers.map(d => d.userId) }, app: 'driver' });
          }
          const tokens = await prisma.deviceToken.findMany({ where: { OR: recipients }, take: 500 });
          if (tokens.length) {
            const result = await messaging().sendEachForMulticast({ tokens: tokens.map(t => t.token), notification: { title: `Fida · ${order.orderNumber}`, body: event.status === 'PENDING' ? 'A new order has been placed.' : `Order ${event.status.toLowerCase().replaceAll('_',' ')}.` }, data: { orderId: order.id, status: event.status }, android: { priority: 'high', notification: { channelId: 'fida_orders', tag: order.id } } });
            let retry = false;
            for (let i = 0; i < result.responses.length; i++) {
              const response = result.responses[i]!;
              if (!response.success) {
                if (['messaging/invalid-registration-token','messaging/registration-token-not-registered'].includes(response.error?.code ?? '')) await prisma.deviceToken.deleteMany({ where: { id: tokens[i]!.id } });
                else retry = true;
              }
            }
            if (retry) throw Error('push_retry_required');
          }
          await prisma.notificationEvent.update({ where: { id: event.id }, data: { sentAt: new Date() } });
        } catch { app.log.warn({ eventId: event.id }, 'Push delivery will retry'); }
      }
    } catch { app.log.warn('Notification worker unavailable'); } finally { running = false; }
  }, 10000);
  timer.unref();
  app.addHook('onClose', async () => clearInterval(timer));
}
