import type { FastifyInstance } from 'fastify';
import { PaymentStatus, prisma } from '@fida/database/client';
import { requirePlatformAdmin } from '../lib/auth.js';

export async function adminFinanceRoutes(app: FastifyInstance) {
  app.get('/v1/admin/finance/summary', { preHandler: requirePlatformAdmin }, async () => {
    const [tenants, grouped] = await Promise.all([
      prisma.tenant.findMany({
        select: { id: true, name: true, currency: true, status: true, platformCommissionPercent: true },
        orderBy: { name: 'asc' },
      }),
      prisma.order.groupBy({
        by: ['tenantId', 'paymentMethod', 'paymentStatus'],
        _count: { _all: true },
        _sum: { total: true, subtotal: true, deliveryFee: true, platformCommissionAmount: true },
      }),
    ]);

    const tenantMap = new Map(tenants.map((tenant) => [tenant.id, tenant]));
    const currencyMap = new Map<string, {
      currency: string;
      orders: number;
      paidOrders: number;
      pendingOrders: number;
      failedOrders: number;
      refundedOrders: number;
      partiallyRefundedOrders: number;
      paidValue: number;
      pendingValue: number;
      merchandiseSales: number;
      platformCommission: number;
      merchantDeliveryValue: number;
      refundedValue: number;
    }>();
    const merchantMap = new Map<string, {
      tenantId: string;
      merchant: string;
      status: string;
      currency: string;
      commissionPercent: number;
      orders: number;
      paidOrders: number;
      pendingOrders: number;
      paidValue: number;
      pendingValue: number;
      merchandiseSales: number;
      platformCommission: number;
      merchantNetSales: number;
      merchantDeliveryValue: number;
    }>();

    for (const row of grouped) {
      const tenant = tenantMap.get(row.tenantId);
      if (!tenant) continue;
      const count = row._count._all;
      const value = Number(row._sum.total ?? 0);
      const subtotal = Number(row._sum.subtotal ?? 0);
      const commission = Number(row._sum.platformCommissionAmount ?? 0);
      const deliveryValue = Number(row._sum.deliveryFee ?? 0);

      const currency = currencyMap.get(tenant.currency) ?? {
        currency: tenant.currency,
        orders: 0,
        paidOrders: 0,
        pendingOrders: 0,
        failedOrders: 0,
        refundedOrders: 0,
        partiallyRefundedOrders: 0,
        paidValue: 0,
        pendingValue: 0,
        merchandiseSales: 0,
        platformCommission: 0,
        merchantDeliveryValue: 0,
        refundedValue: 0,
      };
      currency.orders += count;
      if (row.paymentStatus === PaymentStatus.PAID) {
        currency.paidOrders += count;
        currency.paidValue += value;
        currency.merchandiseSales += subtotal;
        currency.platformCommission += commission;
        currency.merchantDeliveryValue += deliveryValue;
      } else if (row.paymentStatus === PaymentStatus.PENDING || row.paymentStatus === PaymentStatus.AUTHORIZED) {
        currency.pendingOrders += count;
        currency.pendingValue += value;
      } else if (row.paymentStatus === PaymentStatus.FAILED) {
        currency.failedOrders += count;
      } else if (row.paymentStatus === PaymentStatus.REFUNDED) {
        currency.refundedOrders += count;
        currency.refundedValue += value;
      } else if (row.paymentStatus === PaymentStatus.PARTIALLY_REFUNDED) {
        currency.partiallyRefundedOrders += count;
      }
      currencyMap.set(tenant.currency, currency);

      const merchant = merchantMap.get(tenant.id) ?? {
        tenantId: tenant.id,
        merchant: tenant.name,
        status: tenant.status,
        currency: tenant.currency,
        commissionPercent: Number(tenant.platformCommissionPercent),
        orders: 0,
        paidOrders: 0,
        pendingOrders: 0,
        paidValue: 0,
        pendingValue: 0,
        merchandiseSales: 0,
        platformCommission: 0,
        merchantNetSales: 0,
        merchantDeliveryValue: 0,
      };
      merchant.orders += count;
      if (row.paymentStatus === PaymentStatus.PAID) {
        merchant.paidOrders += count;
        merchant.paidValue += value;
        merchant.merchandiseSales += subtotal;
        merchant.platformCommission += commission;
        merchant.merchantNetSales += subtotal - commission;
        merchant.merchantDeliveryValue += deliveryValue;
      } else if (row.paymentStatus === PaymentStatus.PENDING || row.paymentStatus === PaymentStatus.AUTHORIZED) {
        merchant.pendingOrders += count;
        merchant.pendingValue += value;
      }
      merchantMap.set(tenant.id, merchant);
    }

    return {
      currencies: [...currencyMap.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
      merchants: [...merchantMap.values()].sort((a, b) => b.platformCommission - a.platformCommission || a.merchant.localeCompare(b.merchant)),
      paymentGroups: grouped.map((row) => ({
        tenantId: row.tenantId,
        merchant: tenantMap.get(row.tenantId)?.name ?? 'Unknown merchant',
        currency: tenantMap.get(row.tenantId)?.currency ?? 'RWF',
        paymentMethod: row.paymentMethod,
        paymentStatus: row.paymentStatus,
        orders: row._count._all,
        value: Number(row._sum.total ?? 0),
        merchandiseSales: Number(row._sum.subtotal ?? 0),
        platformCommission: Number(row._sum.platformCommissionAmount ?? 0),
        merchantDeliveryValue: Number(row._sum.deliveryFee ?? 0),
      })),
    };
  });
}
