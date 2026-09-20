import { selectedOptions } from '../lib/product-options.js';
import { checkoutTotals } from '../lib/checkout.js';
import { enqueueOrder } from '../lib/notifications.js';
import { branchIsOpen } from '../lib/business-hours.js';
import { randomInt, randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  DeliveryStatus,
  FulfillmentType,
  OrderStatus,
  PaymentMethod,
  Prisma,
  TenantStatus,
  prisma,
} from '@fida/database/client';
import { authenticate } from '../lib/auth.js';
import { quoteBranchDelivery } from '../lib/delivery-pricing.js';

function orderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `FM-${date}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function parseItems(value: unknown) {
 if (!Array.isArray(value) || !value.length || value.length > 50) return null;
 const totals = new Map<string, number>();
 const lines: {productId: string; quantity: number; options: unknown}[] = [];
 for (const raw of value) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.productId === 'string' ? raw.productId.trim() : '';
  if (!id || !Number.isInteger(raw.quantity) || raw.quantity < 1 || raw.quantity > 50) return null;
  const total = (totals.get(id) ?? 0) + raw.quantity;
  if (total > 50) return null;
  totals.set(id, total);
  lines.push({productId: id, quantity: raw.quantity, options: raw.options});
 }
 return {lines, ids: [...totals.keys()]};
}

function validCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export async function orderRoutes(app: FastifyInstance) {
  app.post('/v1/customer/checkout-preview', { preHandler: authenticate }, async(request,reply)=>{
    const b=(request.body??{})as Record<string,unknown>;
    const quantities=parseItems(b.items),tenantId=typeof b.tenantId==='string'?b.tenantId:'';
    if(!quantities||!tenantId)return reply.code(400).send({error:'invalid_items'});
    const products=await prisma.product.findMany({where:{id:{in:quantities.ids},tenantId,isActive:true,isAvailable:true,deletedAt:null,OR:[{categoryId:null},{category:{isActive:true,deletedAt:null}}]}});
    if(products.length!==quantities.ids.length)return reply.code(409).send({error:'product_unavailable'});
    const pricedLines=quantities.lines.map(line=>{const product=products.find(p=>p.id===line.productId)!;const configured=selectedOptions(product,line.options);return {productId:product.id,productName:configured.name,quantity:line.quantity,unitPrice:configured.price,basePrice:product.price};});
    const branch=await prisma.branch.findFirst({where:{id:String(b.branchId??''),tenantId,isActive:true}});
    if(!branch)return reply.code(404).send({error:'branch_not_found'});
    let fee=new Prisma.Decimal(0);
    if(b.fulfillmentType==='DELIVERY'){
      const address=await prisma.customerAddress.findFirst({where:{id:String(b.addressId??''),userId:request.authUser!.id}});
      const lat=address?.latitude??b.latitude??b.deliveryLatitude,lon=address?.longitude??b.longitude??b.deliveryLongitude;
      if(lat===null||lat===undefined||lon===null||lon===undefined||!validCoordinate(Number(lat),Number(lon)))return reply.code(400).send({error:'location_required'});
      const quote=await quoteBranchDelivery(branch.id,Number(lat),Number(lon));if(!quote)return reply.code(409).send({error:'outside_delivery_area'});fee=quote.fee;
    }
    const {usedPromotions,commissionPercent,...totals}=await checkoutTotals(tenantId,pricedLines,fee,typeof b.promoCode==='string'?b.promoCode.trim():null);
    return totals;
  });

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
    if (!quote) {
      return reply.code(409).send({ error: 'outside_delivery_area', message: 'This address is outside the merchant delivery area.' });
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

  app.post('/v1/customer/orders', { preHandler: authenticate }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId : '';
    const branchId = typeof body.branchId === 'string' ? body.branchId : '';
    const quantities = parseItems(body.items);
    const requestedPaymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod.toUpperCase() : '';
    const requestedFulfillment = typeof body.fulfillmentType === 'string' ? body.fulfillmentType.toUpperCase() : FulfillmentType.DELIVERY;

    if (!tenantId || !branchId || !quantities) {
      return reply.code(400).send({ error: 'invalid_order', message: 'Merchant, branch and valid order items are required.' });
    }

    if (!Object.values(PaymentMethod).includes(requestedPaymentMethod as PaymentMethod)) {
      return reply.code(400).send({ error: 'invalid_payment_method', allowed: Object.values(PaymentMethod) });
    }
    if (!Object.values(FulfillmentType).includes(requestedFulfillment as FulfillmentType)) {
      return reply.code(400).send({ error: 'invalid_fulfillment_type', allowed: Object.values(FulfillmentType) });
    }
    const fulfillmentType = requestedFulfillment as FulfillmentType;
    if (requestedPaymentMethod !== 'CASH' && (!process.env.FLUTTERWAVE_SECRET_KEY || !process.env.FLUTTERWAVE_WEBHOOK_SECRET)) return reply.code(409).send({ error: 'payment_unavailable', message: 'Online payments are not configured. Choose cash.' });
    if (requestedPaymentMethod === 'WALLET') return reply.code(400).send({ error: 'wallet_unavailable' });
    const scheduledFor = body.scheduledFor ? new Date(String(body.scheduledFor)) : null;
    if (scheduledFor && (!Number.isFinite(scheduledFor.getTime()) || scheduledFor.getTime() < Date.now() + 30*60000 || scheduledFor.getTime() > Date.now() + 7*86400000)) return reply.code(400).send({ error: 'invalid_schedule', message: 'Schedule between 30 minutes and 7 days ahead.' });
    const checkoutKey = typeof body.checkoutKey === 'string' && /^[a-zA-Z0-9-]{16,100}$/.test(body.checkoutKey) ? `${request.authUser!.id}:${body.checkoutKey}` : null;
    if (checkoutKey) { const existing = await prisma.order.findUnique({where:{checkoutKey}}); if (existing) return reply.code(200).send(existing); }


    const customer = await prisma.user.findUnique({
      where: { id: request.authUser!.id },
      select: { phone: true },
    });
    if (!customer?.phone) {
      return reply.code(409).send({
        error: 'customer_phone_required',
        message: 'Add a phone number to your Fida account before placing an order.',
      });
    }

    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, status: TenantStatus.ACTIVE, isAcceptingOrders: true },
      select: {
        id: true,
        minimumOrder: true,
        platformCommissionPercent: true,
        timezone: true,
        taxPercent: true,
        paymentSubaccount: true,
      },
    });

    if (!tenant) {
      return reply.code(409).send({ error: 'merchant_unavailable', message: 'Merchant is not currently accepting orders.' });
    }

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, tenantId, isActive: true, isAcceptingOrders: true },
      select: {
        id: true,
        pickupEnabled: true,
        deliveryEnabled: true,
        isAcceptingOrders: true,
        openingHours: true,
        closedUntil: true,
      },
    });

    if (!branch) {
      return reply.code(409).send({ error: 'branch_unavailable', message: 'Branch is not currently accepting orders.' });
    }
    if (fulfillmentType === FulfillmentType.PICKUP && !branch.pickupEnabled) {
      return reply.code(409).send({ error: 'pickup_unavailable' });
    }
    if (fulfillmentType === FulfillmentType.DELIVERY && !branch.deliveryEnabled) {
      return reply.code(409).send({ error: 'delivery_unavailable' });
    }

    if (!branchIsOpen(branch, tenant.timezone, scheduledFor ?? new Date())) return reply.code(409).send({ error: 'branch_closed', message: 'This branch is closed at the requested time.' });

    const productIds = quantities.ids;
    if(requestedPaymentMethod!=='CASH'&&!tenant.paymentSubaccount)return reply.code(409).send({error:'merchant_payment_destination_required',message:'Online payments are not yet enabled for this merchant.'});
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId, isActive: true, isAvailable: true, deletedAt: null, OR: [{ categoryId: null }, { category: { isActive: true, deletedAt: null } }] },
      select: { id: true, name: true, price: true, options: true },
    });

    if (products.length !== productIds.length) {
      return reply.code(409).send({ error: 'product_unavailable', message: 'One or more products are unavailable.' });
    }

    let subtotal = new Prisma.Decimal(0);
    const itemData = quantities.lines.map((line) => {
      const product = products.find(p => p.id === line.productId)!;
      const quantity = line.quantity;
      const configured = selectedOptions(product, line.options);
      const lineTotal = configured.price.mul(quantity);
      subtotal = subtotal.plus(lineTotal);
      return {
        basePrice: product.price,
        productId: product.id,
        productName: configured.name,
        quantity,
        unitPrice: configured.price,
        totalPrice: lineTotal,
      };
    });

    if (subtotal.lessThan(tenant.minimumOrder)) {
      return reply.code(409).send({ error: 'minimum_order_not_met', minimumOrder: tenant.minimumOrder, subtotal });
    }

    let deliveryAddress: string | null = null;
    let deliveryLatitude: number | null = null;
    let deliveryLongitude: number | null = null;
    const note=body.cookingInstructions??body.cooking_instructions??body.order_notes;
    if(note!==undefined&&(typeof note!=='string'||note.length>2000))return reply.code(400).send({error:'invalid_cooking_instructions'});
    const cookingInstructions=typeof note==='string'?note.trim()||null:null;
    let deliveryInstructions: string | null = typeof body.deliveryInstructions === 'string' ? body.deliveryInstructions.trim().slice(0,2000) || null : null;
    let deliveryFee = new Prisma.Decimal(0);
    let deliveryDistanceKm: number | null = null;

    if (fulfillmentType === FulfillmentType.DELIVERY) {
      const addressId = typeof body.addressId === 'string' ? body.addressId : null;
      deliveryAddress = typeof body.deliveryAddress === 'string' ? body.deliveryAddress.trim() : '';
      deliveryLatitude = typeof body.deliveryLatitude === 'number' ? body.deliveryLatitude : null;
      deliveryLongitude = typeof body.deliveryLongitude === 'number' ? body.deliveryLongitude : null;


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
      if (!quote) {
        return reply.code(409).send({ error: 'outside_delivery_area', message: 'This address is outside the merchant delivery area.' });
      }
      deliveryFee = quote.fee;
      deliveryDistanceKm = quote.distanceKm;
    }

    const serviceFee = new Prisma.Decimal(0);
    const promoCode = typeof body.promoCode === 'string' ? body.promoCode.trim().toUpperCase() : null;
    const order = await prisma.$transaction(async (tx) => {
      const totals=await checkoutTotals(tenantId,itemData,deliveryFee,promoCode,tx);
      const {discount,tax,total,taxLabel,commissionPercent}=totals;
      if(body.confirmedTotal!==undefined&&(typeof body.confirmedTotal!=='number'||!Number.isFinite(body.confirmedTotal)||!total.equals(body.confirmedTotal)))throw Object.assign(new Error('The total changed. Review the updated checkout before ordering.'),{statusCode:409});
      const commissionAmount=subtotal.minus(discount).mul(commissionPercent).div(100).toDecimalPlaces(2,Prisma.Decimal.ROUND_HALF_UP);
      for(const promotion of totals.usedPromotions){
        const redeemed=await tx.promotion.updateMany({where:{id:promotion.id,isActive:true,expiresAt:{gt:new Date()},usedCount:{lt:promotion.maxUses},updatedAt:promotion.updatedAt},data:{usedCount:{increment:1}}});
        if(!redeemed.count)throw Object.assign(new Error('Promotion changed. Refresh checkout and retry.'),{statusCode:409});
      }
      const created = await tx.order.create({
        data: {
          orderNumber: orderNumber(),
          checkoutKey, scheduledFor, promoCode, tax, taxLabel, cookingInstructions,
          deliveryPin: fulfillmentType === FulfillmentType.DELIVERY ? String(randomInt(1000,10000)) : null,
          tenantId,
          branchId,
          customerId: request.authUser!.id,
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
          items: { create: totals.items },
          ...(fulfillmentType === FulfillmentType.DELIVERY
            ? { delivery: { create: { status: DeliveryStatus.UNASSIGNED } } }
            : {}),
        },
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          branch: { select: { id: true, name: true, city: true } },
          items: true,
          delivery: true,
        },
      });
      await enqueueOrder(tx, created.id, created.status);
      return created;
    });

    return reply.code(201).send(order);
  });

  app.get('/v1/customer/orders', { preHandler: authenticate }, async (request) => {
    return prisma.order.findMany({
      where: { customerId: request.authUser!.id },
      include: {
        tenant: { select: { id: true, name: true, slug: true, currency: true } },
        branch: { select: { id: true, name: true, city: true, addressLine: true, latitude: true, longitude: true } },
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
        tenant: { select: { id: true, name: true, slug: true, currency: true } },
        branch: { select: { id: true, name: true, city: true, addressLine: true, latitude: true, longitude: true } },
        items: true,
        delivery: { include: { driver: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } } } },
      },
    });

    if (!order) return reply.code(404).send({ error: 'order_not_found' });

    return {
      ...order,
      deliveryLatitude: order.deliveryLatitude === null ? null : Number(order.deliveryLatitude),
      deliveryLongitude: order.deliveryLongitude === null ? null : Number(order.deliveryLongitude),
      delivery: order.delivery
        ? {
            ...order.delivery,
            driver: order.delivery.driver
              ? {
                  ...order.delivery.driver,
                  latitude: ['COMPLETED','CANCELLED','REJECTED'].includes(order.status) || order.delivery.driver.latitude === null ? null : Number(order.delivery.driver.latitude),
                  longitude: ['COMPLETED','CANCELLED','REJECTED'].includes(order.status) || order.delivery.driver.longitude === null ? null : Number(order.delivery.driver.longitude),
                }
              : null,
          }
        : null,
    };
  });

  app.post('/v1/customer/orders/:orderId/cancel', { preHandler: authenticate }, async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await prisma.order.findFirst({ where: { id: orderId, customerId: request.authUser!.id }, select: { id: true, status: true } });

    if (!order) return reply.code(404).send({ error: 'order_not_found' });
    const cancellable: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.ACCEPTED];
    if (!cancellable.includes(order.status)) {
      return reply.code(409).send({
        error: 'order_cannot_be_cancelled',
        status: order.status,
        message: 'Orders can only be cancelled before preparation starts.',
      });
    }

    await prisma.$transaction(async tx => {
      const changed = await tx.order.updateMany({ where: { id: order.id, status: { in: cancellable } }, data: { status: OrderStatus.CANCELLED } });
      if (!changed.count) throw Object.assign(new Error('Order preparation already started.'), { statusCode: 409 });
      await tx.delivery.updateMany({ where: { orderId: order.id }, data: { status: DeliveryStatus.CANCELLED } });
      await enqueueOrder(tx, order.id, 'CANCELLED');
    });

    return { success: true, status: OrderStatus.CANCELLED };
  });
}
