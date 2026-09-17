import type { FastifyInstance } from 'fastify';
import { OrderStatus, PaymentStatus, prisma } from '@fida/database/client';
import { requirePlatformAdmin } from '../lib/auth.js';

const maxReportDays = 93;
const maxReportOrders = 20_000;

function parseDate(value: unknown, endOfDay = false) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function defaultPeriod() {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  from.setUTCHours(0, 0, 0, 0);
  return { from, to };
}

export async function adminReportRoutes(app: FastifyInstance) {
  app.get('/v1/admin/reports/overview', { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const defaults = defaultPeriod();
    const requestedFrom = query.from === undefined ? defaults.from : parseDate(query.from);
    const requestedTo = query.to === undefined ? defaults.to : parseDate(query.to, true);
    const tenantId = typeof query.tenantId === 'string' ? query.tenantId.trim() : '';

    if (!requestedFrom || !requestedTo || requestedFrom > requestedTo) {
      return reply.code(400).send({ error: 'invalid_report_period' });
    }

    const durationDays = Math.ceil((requestedTo.getTime() - requestedFrom.getTime()) / 86_400_000) + 1;
    if (durationDays > maxReportDays) {
      return reply.code(400).send({ error: 'report_period_too_long', maxDays: maxReportDays });
    }

    if (tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
      if (!tenant) return reply.code(404).send({ error: 'tenant_not_found' });
    }

    const where = {
      createdAt: { gte: requestedFrom, lte: requestedTo },
      ...(tenantId ? { tenantId } : {}),
    };

    const count = await prisma.order.count({ where });
    if (count > maxReportOrders) {
      return reply.code(422).send({
        error: 'report_too_large',
        message: 'Narrow the report period or select one merchant.',
        orders: count,
        maxOrders: maxReportOrders,
      });
    }

    const orders = await prisma.order.findMany({
      where,
      select: {
        id: true,
        tenantId: true,
        status: true,
        fulfillmentType: true,
        paymentMethod: true,
        paymentStatus: true,
        subtotal: true,
        deliveryFee: true,
        discount: true,
        total: true,
        platformCommissionAmount: true,
        createdAt: true,
        tenant: { select: { id: true, name: true, currency: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const orderStatuses = new Map<string, number>();
    const paymentStatuses = new Map<string, number>();
    const currencyMap = new Map<string, {
      currency: string;
      orders: number;
      completedOrders: number;
      paidOrders: number;
      paidValue: number;
      merchandiseSalesPaid: number;
      platformCommissionPaid: number;
      merchantDeliveryValuePaid: number;
    }>();
    const merchantMap = new Map<string, {
      tenantId: string;
      merchant: string;
      status: string;
      currency: string;
      orders: number;
      completedOrders: number;
      paidOrders: number;
      paidValue: number;
      merchandiseSalesPaid: number;
      platformCommissionPaid: number;
      merchantDeliveryValuePaid: number;
    }>();
    const dailyMap = new Map<string, {
      date: string;
      currency: string;
      orders: number;
      completedOrders: number;
      paidOrders: number;
      paidValue: number;
      platformCommissionPaid: number;
    }>();

    for (const order of orders) {
      orderStatuses.set(order.status, (orderStatuses.get(order.status) ?? 0) + 1);
      paymentStatuses.set(order.paymentStatus, (paymentStatuses.get(order.paymentStatus) ?? 0) + 1);

      const total = Number(order.total);
      const subtotal = Number(order.subtotal);
      const commission = Number(order.platformCommissionAmount);
      const deliveryValue = Number(order.deliveryFee);
      const isCompleted = order.status === OrderStatus.COMPLETED;
      const isPaid = order.paymentStatus === PaymentStatus.PAID;

      const currency = currencyMap.get(order.tenant.currency) ?? {
        currency: order.tenant.currency,
        orders: 0,
        completedOrders: 0,
        paidOrders: 0,
        paidValue: 0,
        merchandiseSalesPaid: 0,
        platformCommissionPaid: 0,
        merchantDeliveryValuePaid: 0,
      };
      currency.orders += 1;
      if (isCompleted) currency.completedOrders += 1;
      if (isPaid) {
        currency.paidOrders += 1;
        currency.paidValue += total;
        currency.merchandiseSalesPaid += subtotal;
        currency.platformCommissionPaid += commission;
        currency.merchantDeliveryValuePaid += deliveryValue;
      }
      currencyMap.set(order.tenant.currency, currency);

      const merchant = merchantMap.get(order.tenantId) ?? {
        tenantId: order.tenantId,
        merchant: order.tenant.name,
        status: order.tenant.status,
        currency: order.tenant.currency,
        orders: 0,
        completedOrders: 0,
        paidOrders: 0,
        paidValue: 0,
        merchandiseSalesPaid: 0,
        platformCommissionPaid: 0,
        merchantDeliveryValuePaid: 0,
      };
      merchant.orders += 1;
      if (isCompleted) merchant.completedOrders += 1;
      if (isPaid) {
        merchant.paidOrders += 1;
        merchant.paidValue += total;
        merchant.merchandiseSalesPaid += subtotal;
        merchant.platformCommissionPaid += commission;
        merchant.merchantDeliveryValuePaid += deliveryValue;
      }
      merchantMap.set(order.tenantId, merchant);

      const date = order.createdAt.toISOString().slice(0, 10);
      const dayKey = `${date}:${order.tenant.currency}`;
      const daily = dailyMap.get(dayKey) ?? {
        date,
        currency: order.tenant.currency,
        orders: 0,
        completedOrders: 0,
        paidOrders: 0,
        paidValue: 0,
        platformCommissionPaid: 0,
      };
      daily.orders += 1;
      if (isCompleted) daily.completedOrders += 1;
      if (isPaid) {
        daily.paidOrders += 1;
        daily.paidValue += total;
        daily.platformCommissionPaid += commission;
      }
      dailyMap.set(dayKey, daily);
    }

    return {
      period: { from: requestedFrom.toISOString(), to: requestedTo.toISOString(), days: durationDays },
      orders: orders.length,
      orderStatuses: [...orderStatuses.entries()].map(([status, total]) => ({ status, total })),
      paymentStatuses: [...paymentStatuses.entries()].map(([status, total]) => ({ status, total })),
      currencies: [...currencyMap.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
      merchants: [...merchantMap.values()].sort((a, b) => b.orders - a.orders || a.merchant.localeCompare(b.merchant)),
      daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date) || a.currency.localeCompare(b.currency)),
    };
  });
}
