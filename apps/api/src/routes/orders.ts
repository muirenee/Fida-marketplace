import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  DeliveryStatus,
  OrderStatus,
  PaymentMethod,
  Prisma,
  TenantStatus,
  prisma,
} from '@fida/database/client';
import { authenticate } from '../lib/auth.js';

function orderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `FM-${date}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function parseItems(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) return null;

  const quantities = new Map<string, number>();
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    const productId = typeof row.productId === 'string' ? row.productId.trim() : '';
    const quantity = typeof row.quantity === 'number' ? Math.trunc(row.quantity) : NaN;
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) return null;

    const nextQuantity = (quantities.get(productId) ?? 0) + quantity;
    if (nextQuantity > 50) return null;
    quantities.set(productId, nextQuantity);
  }

  return quantities;
}

export async function orderRoutes(app: FastifyInstance) {
  app.post('/v1/customer/orders', { preHandler: authenticate }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId : '';
    const branchId = typeof body.branchId === 'string' ? body.branchId : '';
    const quantities = parseItems(body.items);
    const requestedPaymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod.toUpperCase() : '';

    if (!tenantId || !branchId || !quantities) {
      return reply.code(400).send({ error: 'invalid_order', message: 'Merchant, branch and valid order items are required.' });
    }

    if (!Object.values(PaymentMethod).includes(requestedPaymentMethod as PaymentMethod)) {
      return reply.code(400).send({ error: 'invalid_payment_method', allowed: Object.values(PaymentMethod) });
    }

    const tenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        status: TenantStatus.ACTIVE,
        isAcceptingOrders: true,
      },
      select: {
        id: true,
        minimumOrder: true,
        defaultDeliveryFee: true,
        serviceFeePercent: true,
      },
    });

    if (!tenant) {
      return reply.code(409).send({ error: 'merchant_unavailable', message: 'Merchant is not currently accepting orders.' });
    }

    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        tenantId,
        isActive: true,
        isAcceptingOrders: true,
      },
      select: { id: true },
    });

    if (!branch) {
      return reply.code(409).send({ error: 'branch_unavailable', message: 'Branch is not currently accepting orders.' });
    }

    const productIds = [...quantities.keys()];
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId,
        isActive: true,
        isAvailable: true,
      },
      select: { id: true, name: true, price: true },
    });

    if (products.length !== productIds.length) {
      return reply.code(409).send({ error: 'product_unavailable', message: 'One or more products are unavailable.' });
    }

    let subtotal = new Prisma.Decimal(0);
    const itemData = products.map((product) => {
      const quantity = quantities.get(product.id)!;
      const lineTotal = product.price.mul(quantity);
      subtotal = subtotal.plus(lineTotal);
      return {
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        totalPrice: lineTotal,
      };
    });

    if (subtotal.lessThan(tenant.minimumOrder)) {
      return reply.code(409).send({
        error: 'minimum_order_not_met',
        minimumOrder: tenant.minimumOrder,
        subtotal,
      });
    }

    const addressId = typeof body.addressId === 'string' ? body.addressId : null;
    let deliveryAddress = typeof body.deliveryAddress === 'string' ? body.deliveryAddress.trim() : '';
    let deliveryLatitude = typeof body.deliveryLatitude === 'number' ? body.deliveryLatitude : null;
    let deliveryLongitude = typeof body.deliveryLongitude === 'number' ? body.deliveryLongitude : null;
    let deliveryInstructions = typeof body.deliveryInstructions === 'string' ? body.deliveryInstructions.trim() || null : null;

    if (addressId) {
      const savedAddress = await prisma.customerAddress.findFirst({
        where: { id: addressId, userId: request.authUser!.id },
      });
      if (!savedAddress) return reply.code(404).send({ error: 'address_not_found' });

      deliveryAddress = savedAddress.addressLine;
      deliveryLatitude = savedAddress.latitude ? Number(savedAddress.latitude) : null;
      deliveryLongitude = savedAddress.longitude ? Number(savedAddress.longitude) : null;
      deliveryInstructions = deliveryInstructions ?? savedAddress.instructions;
    }

    if (!deliveryAddress) {
      return reply.code(400).send({ error: 'delivery_address_required' });
    }

    const deliveryFee = tenant.defaultDeliveryFee;
    const serviceFee = subtotal
      .mul(tenant.serviceFeePercent)
      .div(100)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const discount = new Prisma.Decimal(0);
    const total = subtotal.plus(deliveryFee).plus(serviceFee).minus(discount);

    const order = await prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          orderNumber: orderNumber(),
          tenantId,
          branchId,
          customerId: request.authUser!.id,
          paymentMethod: requestedPaymentMethod as PaymentMethod,
          subtotal,
          deliveryFee,
          serviceFee,
          discount,
          total,
          deliveryAddress,
          deliveryLatitude,
          deliveryLongitude,
          deliveryInstructions,
          items: { create: itemData },
          delivery: { create: { status: DeliveryStatus.UNASSIGNED } },
        },
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          branch: { select: { id: true, name: true, city: true } },
          items: true,
          delivery: true,
        },
      });
    });

    return reply.code(201).send(order);
  });

  app.get('/v1/customer/orders', { preHandler: authenticate }, async (request) => {
    return prisma.order.findMany({
      where: { customerId: request.authUser!.id },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true, city: true } },
        items: true,
        delivery: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  app.get('/v1/customer/orders/:orderId', { preHandler: authenticate }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId: request.authUser!.id },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true, city: true } },
        items: true,
        delivery: { include: { driver: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } } } },
      },
    });

    if (!order) return reply.code(404).send({ error: 'order_not_found' });
    return order;
  });

  app.post('/v1/customer/orders/:orderId/cancel', { preHandler: authenticate }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId: request.authUser!.id },
      select: { id: true, status: true },
    });

    if (!order) return reply.code(404).send({ error: 'order_not_found' });
    if (order.status !== OrderStatus.PENDING) {
      return reply.code(409).send({ error: 'order_cannot_be_cancelled', status: order.status });
    }

    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED } }),
      prisma.delivery.updateMany({ where: { orderId: order.id }, data: { status: DeliveryStatus.CANCELLED } }),
    ]);

    return { success: true, status: OrderStatus.CANCELLED };
  });
}
