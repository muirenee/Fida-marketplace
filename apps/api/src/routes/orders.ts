import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  DeliveryStatus,
  FulfillmentType,
  OrderStatus,
  PaymentMethod,
  Prisma,
  PromotionType,
  TenantStatus,
  prisma,
} from '@fida/database/client';
import { authenticate } from '../lib/auth.js';
import { quoteBranchDelivery } from '../lib/delivery-pricing.js';

function orderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `FM-${date}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

type ParsedItem = {
  productId: string;
  quantity: number;
  modifierOptionIds: string[];
};

function parseItems(value: unknown): ParsedItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) return null;

  let totalQuantity = 0;
  const result: ParsedItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    const productId = typeof row.productId === 'string' ? row.productId.trim() : '';
    const quantity = typeof row.quantity === 'number' ? Math.trunc(row.quantity) : NaN;
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) return null;

    const rawModifiers = row.modifierOptionIds ?? [];
    if (!Array.isArray(rawModifiers) || rawModifiers.length > 30) return null;
    const modifierOptionIds = [...new Set(rawModifiers.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean))];
    if (modifierOptionIds.length !== rawModifiers.length) return null;

    totalQuantity += quantity;
    if (totalQuantity > 50) return null;
    result.push({ productId, quantity, modifierOptionIds });
  }
  return result;
}

function validCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function promotionDiscount(
  promotion: { type: PromotionType; value: Prisma.Decimal; maxDiscount: Prisma.Decimal | null },
  subtotal: Prisma.Decimal,
) {
  let discount = promotion.type === PromotionType.PERCENTAGE
    ? subtotal.mul(promotion.value).div(100)
    : promotion.value;
  if (promotion.maxDiscount !== null && discount.greaterThan(promotion.maxDiscount)) discount = promotion.maxDiscount;
  if (discount.greaterThan(subtotal)) discount = subtotal;
  if (discount.lessThan(0)) discount = new Prisma.Decimal(0);
  return discount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

async function activePromotion(tenantId: string, code: string) {
  const now = new Date();
  return prisma.promotion.findFirst({
    where: {
      tenantId,
      isActive: true,
      code: { equals: code, mode: 'insensitive' },
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
  });
}

export async function orderRoutes(app: FastifyInstance) {
  app.get('/v1/customer/delivery-quote', { preHandler: authenticate }, async (request, reply) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const branchId = typeof query.branchId === 'string' ? query.branchId : '';
    const addressId = typeof query.addressId === 'string' ? query.addressId : '';
    if (!branchId || !addressId) return reply.code(400).send({ error: 'branch_and_address_required' });

    const [branch, address] = await Promise.all([
      prisma.branch.findFirst({
        where: { id: branchId, isActive: true, isAcceptingOrders: true, deliveryEnabled: true, tenant: { status: TenantStatus.ACTIVE, isAcceptingOrders: true } },
        select: { id: true, tenant: { select: { id: true, currency: true } } },
      }),
      prisma.customerAddress.findFirst({
        where: { id: addressId, userId: request.authUser!.id },
        select: { id: true, latitude: true, longitude: true },
      }),
    ]);

    if (!branch) return reply.code(404).send({ error: 'branch_not_found' });
    if (!address) return reply.code(404).send({ error: 'address_not_found' });
    if (address.latitude === null || address.longitude === null) {
      return reply.code(409).send({ error: 'address_location_required', message: 'Choose a precise location for this delivery address.' });
    }

    const quote = await quoteBranchDelivery(branch.id, Number(address.latitude), Number(address.longitude));
    if (!quote) return reply.code(409).send({ error: 'outside_delivery_area', message: 'This address is outside the merchant delivery area.' });

    return {
      branchId: branch.id,
      tenantId: branch.tenant.id,
      currency: branch.tenant.currency,
      distanceKm: quote.distanceKm,
      deliveryPrice: quote.fee,
      freeDelivery: quote.fee.isZero(),
    };
  });

  app.post('/v1/customer/promotions/validate', { preHandler: authenticate }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const subtotalValue = typeof body.subtotal === 'number' ? body.subtotal : Number(body.subtotal);
    if (!tenantId || !code || !Number.isFinite(subtotalValue) || subtotalValue < 0) {
      return reply.code(400).send({ error: 'invalid_promotion_request', message: 'Merchant, promo code and subtotal are required.' });
    }

    const promotion = await activePromotion(tenantId, code);
    if (!promotion) return reply.code(404).send({ error: 'promotion_not_found', message: 'This promo code is not valid.' });
    if (promotion.usageLimit !== null && promotion.usageCount >= promotion.usageLimit) {
      return reply.code(409).send({ error: 'promotion_limit_reached', message: 'This promo code has reached its usage limit.' });
    }

    const subtotal = new Prisma.Decimal(subtotalValue);
    if (subtotal.lessThan(promotion.minimumOrder)) {
      return reply.code(409).send({
        error: 'promotion_minimum_not_met',
        message: `Spend at least ${promotion.minimumOrder.toString()} before using this promo code.`,
        minimumOrder: promotion.minimumOrder,
      });
    }

    const discount = promotionDiscount(promotion, subtotal);
    return {
      id: promotion.id,
      code: promotion.code,
      type: promotion.type,
      value: promotion.value,
      minimumOrder: promotion.minimumOrder,
      maxDiscount: promotion.maxDiscount,
      discount,
    };
  });

  app.post('/v1/customer/orders', { preHandler: authenticate }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId : '';
    const branchId = typeof body.branchId === 'string' ? body.branchId : '';
    const parsedItems = parseItems(body.items);
    const requestedPaymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod.toUpperCase() : '';
    const requestedFulfillment = typeof body.fulfillmentType === 'string' ? body.fulfillmentType.toUpperCase() : FulfillmentType.DELIVERY;
    const requestedPromoCode = typeof body.promoCode === 'string' ? body.promoCode.trim() : '';

    if (!tenantId || !branchId || !parsedItems) {
      return reply.code(400).send({ error: 'invalid_order', message: 'Merchant, branch and valid order items are required.' });
    }
    if (!Object.values(PaymentMethod).includes(requestedPaymentMethod as PaymentMethod)) {
      return reply.code(400).send({ error: 'invalid_payment_method', allowed: Object.values(PaymentMethod) });
    }
    if (!Object.values(FulfillmentType).includes(requestedFulfillment as FulfillmentType)) {
      return reply.code(400).send({ error: 'invalid_fulfillment_type', allowed: Object.values(FulfillmentType) });
    }
    const fulfillmentType = requestedFulfillment as FulfillmentType;

    const customer = await prisma.user.findUnique({ where: { id: request.authUser!.id }, select: { phone: true } });
    if (!customer?.phone) {
      return reply.code(409).send({ error: 'customer_phone_required', message: 'Add a phone number to your Fida account before placing an order.' });
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, status: TenantStatus.ACTIVE, isAcceptingOrders: true },
      select: { id: true, minimumOrder: true, platformCommissionPercent: true },
    });
    if (!tenant) return reply.code(409).send({ error: 'merchant_unavailable', message: 'Merchant is not currently accepting orders.' });

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, tenantId, isActive: true, isAcceptingOrders: true },
      select: { id: true, pickupEnabled: true, deliveryEnabled: true },
    });
    if (!branch) return reply.code(409).send({ error: 'branch_unavailable', message: 'Branch is not currently accepting orders.' });
    if (fulfillmentType === FulfillmentType.PICKUP && !branch.pickupEnabled) return reply.code(409).send({ error: 'pickup_unavailable' });
    if (fulfillmentType === FulfillmentType.DELIVERY && !branch.deliveryEnabled) return reply.code(409).send({ error: 'delivery_unavailable' });

    const productIds = [...new Set(parsedItems.map((item) => item.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId, isActive: true, isAvailable: true },
      select: {
        id: true,
        name: true,
        price: true,
        modifierGroups: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            minSelections: true,
            maxSelections: true,
            isRequired: true,
            options: {
              where: { isActive: true },
              select: { id: true, name: true, priceDelta: true },
            },
          },
        },
      },
    });
    if (products.length !== productIds.length) {
      return reply.code(409).send({ error: 'product_unavailable', message: 'One or more products are unavailable.' });
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    let subtotal = new Prisma.Decimal(0);
    const itemData: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
      modifiers: { create: Array<{ optionId: string; groupName: string; optionName: string; priceDelta: Prisma.Decimal }> };
    }> = [];

    for (const line of parsedItems) {
      const product = productMap.get(line.productId)!;
      const selectedIds = new Set(line.modifierOptionIds);
      const selectedOptions: Array<{ optionId: string; groupName: string; optionName: string; priceDelta: Prisma.Decimal }> = [];
      const availableIds = new Set<string>();

      for (const group of product.modifierGroups) {
        const groupSelected = group.options.filter((option) => selectedIds.has(option.id));
        for (const option of group.options) availableIds.add(option.id);
        const requiredMin = Math.max(group.minSelections, group.isRequired ? 1 : 0);
        const maxSelections = Math.max(group.maxSelections, requiredMin);
        if (groupSelected.length < requiredMin || groupSelected.length > maxSelections) {
          return reply.code(409).send({
            error: 'invalid_modifier_selection',
            message: `Choose a valid number of options for ${group.name}.`,
            groupId: group.id,
          });
        }
        for (const option of groupSelected) {
          selectedOptions.push({ optionId: option.id, groupName: group.name, optionName: option.name, priceDelta: option.priceDelta });
        }
      }

      for (const selectedId of selectedIds) {
        if (!availableIds.has(selectedId)) {
          return reply.code(409).send({ error: 'invalid_modifier_option', message: 'One or more selected add-ons are no longer available.' });
        }
      }

      const modifierTotal = selectedOptions.reduce((sum, option) => sum.plus(option.priceDelta), new Prisma.Decimal(0));
      const unitPrice = product.price.plus(modifierTotal);
      const lineTotal = unitPrice.mul(line.quantity);
      subtotal = subtotal.plus(lineTotal);
      itemData.push({
        productId: product.id,
        productName: product.name,
        quantity: line.quantity,
        unitPrice,
        totalPrice: lineTotal,
        modifiers: { create: selectedOptions },
      });
    }

    if (subtotal.lessThan(tenant.minimumOrder)) {
      return reply.code(409).send({ error: 'minimum_order_not_met', minimumOrder: tenant.minimumOrder, subtotal });
    }

    let promotion: Awaited<ReturnType<typeof activePromotion>> = null;
    let discount = new Prisma.Decimal(0);
    if (requestedPromoCode) {
      promotion = await activePromotion(tenantId, requestedPromoCode);
      if (!promotion) return reply.code(409).send({ error: 'promotion_not_found', message: 'This promo code is no longer valid.' });
      if (promotion.usageLimit !== null && promotion.usageCount >= promotion.usageLimit) {
        return reply.code(409).send({ error: 'promotion_limit_reached', message: 'This promo code has reached its usage limit.' });
      }
      if (subtotal.lessThan(promotion.minimumOrder)) {
        return reply.code(409).send({ error: 'promotion_minimum_not_met', minimumOrder: promotion.minimumOrder, message: 'The order no longer meets the minimum spend for this promo code.' });
      }
      discount = promotionDiscount(promotion, subtotal);
    }

    let deliveryAddress: string | null = null;
    let deliveryLatitude: number | null = null;
    let deliveryLongitude: number | null = null;
    let deliveryInstructions: string | null = null;
    let deliveryFee = new Prisma.Decimal(0);
    let deliveryDistanceKm: number | null = null;

    if (fulfillmentType === FulfillmentType.DELIVERY) {
      const addressId = typeof body.addressId === 'string' ? body.addressId : null;
      deliveryAddress = typeof body.deliveryAddress === 'string' ? body.deliveryAddress.trim() : '';
      deliveryLatitude = typeof body.deliveryLatitude === 'number' ? body.deliveryLatitude : null;
      deliveryLongitude = typeof body.deliveryLongitude === 'number' ? body.deliveryLongitude : null;
      deliveryInstructions = typeof body.deliveryInstructions === 'string' ? body.deliveryInstructions.trim() || null : null;

      if (addressId) {
        const savedAddress = await prisma.customerAddress.findFirst({ where: { id: addressId, userId: request.authUser!.id } });
        if (!savedAddress) return reply.code(404).send({ error: 'address_not_found' });
        deliveryAddress = savedAddress.addressLine;
        deliveryLatitude = savedAddress.latitude ? Number(savedAddress.latitude) : null;
        deliveryLongitude = savedAddress.longitude ? Number(savedAddress.longitude) : null;
        deliveryInstructions = deliveryInstructions ?? savedAddress.instructions;
      }

      if (!deliveryAddress) return reply.code(400).send({ error: 'delivery_address_required' });
      if (deliveryLatitude === null || deliveryLongitude === null || !validCoordinate(deliveryLatitude, deliveryLongitude)) {
        return reply.code(409).send({ error: 'delivery_location_required', message: 'A precise delivery location is required to calculate delivery price.' });
      }

      const quote = await quoteBranchDelivery(branch.id, deliveryLatitude, deliveryLongitude);
      if (!quote) return reply.code(409).send({ error: 'outside_delivery_area', message: 'This address is outside the merchant delivery area.' });
      deliveryFee = quote.fee;
      deliveryDistanceKm = quote.distanceKm;
    }

    const serviceFee = new Prisma.Decimal(0);
    const totalBeforeDiscount = subtotal.plus(deliveryFee).plus(serviceFee);
    const total = Prisma.Decimal.max(totalBeforeDiscount.minus(discount), new Prisma.Decimal(0));
    const commissionPercent = tenant.platformCommissionPercent;
    const commissionAmount = subtotal.mul(commissionPercent).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: orderNumber(),
          tenantId,
          branchId,
          customerId: request.authUser!.id,
          promotionId: promotion?.id ?? null,
          promoCode: promotion?.code ?? null,
          fulfillmentType,
          paymentMethod: requestedPaymentMethod as PaymentMethod,
          subtotal,
          deliveryFee,
          serviceFee,
          discount,
          total,
          platformCommissionPercent: commissionPercent,
          platformCommissionAmount: commissionAmount,
          deliveryDistanceKm,
          deliveryAddress,
          deliveryLatitude,
          deliveryLongitude,
          deliveryInstructions,
          items: { create: itemData },
          ...(fulfillmentType === FulfillmentType.DELIVERY ? { delivery: { create: { status: DeliveryStatus.UNASSIGNED } } } : {}),
        },
        include: {
          tenant: { select: { id: true, name: true, slug: true, currency: true } },
          branch: { select: { id: true, name: true, city: true } },
          items: { include: { modifiers: true } },
          delivery: true,
        },
      });
      if (promotion) await tx.promotion.update({ where: { id: promotion.id }, data: { usageCount: { increment: 1 } } });
      return created;
    });

    return reply.code(201).send(order);
  });

  app.get('/v1/customer/orders', { preHandler: authenticate }, async (request) => {
    return prisma.order.findMany({
      where: { customerId: request.authUser!.id },
      include: {
        tenant: { select: { id: true, name: true, slug: true, currency: true, logoUrl: true } },
        branch: { select: { id: true, name: true, city: true } },
        items: { include: { modifiers: true } },
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
        tenant: { select: { id: true, name: true, slug: true, currency: true, logoUrl: true } },
        branch: { select: { id: true, name: true, city: true, addressLine: true, latitude: true, longitude: true } },
        items: { include: { modifiers: true } },
        delivery: { include: { driver: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } } } },
      },
    });
    if (!order) return reply.code(404).send({ error: 'order_not_found' });

    return {
      ...order,
      deliveryLatitude: order.deliveryLatitude === null ? null : Number(order.deliveryLatitude),
      deliveryLongitude: order.deliveryLongitude === null ? null : Number(order.deliveryLongitude),
      branch: {
        ...order.branch,
        latitude: order.branch.latitude === null ? null : Number(order.branch.latitude),
        longitude: order.branch.longitude === null ? null : Number(order.branch.longitude),
      },
      delivery: order.delivery
        ? {
            ...order.delivery,
            driver: order.delivery.driver
              ? {
                  ...order.delivery.driver,
                  latitude: order.delivery.driver.latitude === null ? null : Number(order.delivery.driver.latitude),
                  longitude: order.delivery.driver.longitude === null ? null : Number(order.delivery.driver.longitude),
                }
              : null,
          }
        : null,
    };
  });

  app.get('/v1/customer/orders/:orderId/tracking', { preHandler: authenticate }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId: request.authUser!.id },
      select: {
        orderNumber: true,
        status: true,
        fulfillmentType: true,
        deliveryLatitude: true,
        deliveryLongitude: true,
        branch: { select: { latitude: true, longitude: true, name: true } },
        delivery: {
          select: {
            status: true,
            driver: {
              select: {
                latitude: true,
                longitude: true,
                lastSeenAt: true,
                user: { select: { firstName: true, lastName: true, phone: true } },
              },
            },
          },
        },
      },
    });
    if (!order) return reply.code(404).send({ error: 'order_not_found' });
    if (order.fulfillmentType !== FulfillmentType.DELIVERY) return reply.code(409).send({ error: 'tracking_not_available_for_pickup' });

    const driver = order.delivery?.driver;
    const driverName = driver
      ? [driver.user.firstName, driver.user.lastName].filter((value) => value && value.trim()).join(' ')
      : '';
    return {
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      deliveryStatus: order.delivery?.status ?? null,
      pickup: order.branch.latitude !== null && order.branch.longitude !== null
        ? { latitude: Number(order.branch.latitude), longitude: Number(order.branch.longitude), name: order.branch.name }
        : null,
      destination: order.deliveryLatitude !== null && order.deliveryLongitude !== null
        ? { latitude: Number(order.deliveryLatitude), longitude: Number(order.deliveryLongitude) }
        : null,
      driver: driver && driver.latitude !== null && driver.longitude !== null
        ? {
            latitude: Number(driver.latitude),
            longitude: Number(driver.longitude),
            lastSeenAt: driver.lastSeenAt,
            name: driverName || 'Fida courier',
            phone: driver.user.phone,
          }
        : null,
    };
  });

  app.get('/v1/customer/orders/:orderId/receipt', { preHandler: authenticate }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId: request.authUser!.id },
      select: {
        orderNumber: true,
        createdAt: true,
        subtotal: true,
        deliveryFee: true,
        serviceFee: true,
        discount: true,
        total: true,
        paymentMethod: true,
        paymentStatus: true,
        promoCode: true,
        tenant: { select: { name: true, currency: true } },
        items: {
          select: {
            productName: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            modifiers: { select: { groupName: true, optionName: true, priceDelta: true } },
          },
        },
      },
    });
    if (!order) return reply.code(404).send({ error: 'order_not_found' });

    return {
      receiptNumber: `R-${order.orderNumber}`,
      orderNumber: order.orderNumber,
      issuedAt: order.createdAt,
      merchantName: order.tenant.name,
      currency: order.tenant.currency,
      items: order.items,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      serviceFee: order.serviceFee,
      discount: order.discount,
      total: order.total,
      promoCode: order.promoCode,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
    };
  });

  app.post('/v1/customer/orders/:orderId/cancel', { preHandler: authenticate }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await prisma.order.findFirst({ where: { id: orderId, customerId: request.authUser!.id }, select: { id: true, status: true } });
    if (!order) return reply.code(404).send({ error: 'order_not_found' });

    const cancellable: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.ACCEPTED];
    if (!cancellable.includes(order.status)) {
      return reply.code(409).send({ error: 'order_cannot_be_cancelled', status: order.status, message: 'Orders can only be cancelled before preparation starts.' });
    }

    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED } }),
      prisma.delivery.updateMany({ where: { orderId: order.id }, data: { status: DeliveryStatus.CANCELLED } }),
    ]);
    return { success: true, status: OrderStatus.CANCELLED };
  });
}
