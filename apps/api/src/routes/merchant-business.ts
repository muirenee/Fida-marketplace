import type { FastifyInstance } from 'fastify';
import { MembershipRole, Prisma, prisma } from '@fida/database/client';
import { merchantWriteRoles, requireTenant } from '../lib/tenant.js';
import { hashPassword } from '../lib/security.js';
import { validateHours } from '../lib/business-hours.js';

const admins = [MembershipRole.OWNER, MembershipRole.ADMIN];
export const driverUserSelect = { id: true, email: true, phone: true, firstName: true, lastName: true, isActive: true };
const activeDelivery = ['ASSIGNED', 'AT_PICKUP', 'PICKED_UP', 'AT_DROPOFF'] as const;
const text = (v: unknown, max = 160) => typeof v === 'string' ? v.trim().slice(0, max) : '';

export async function merchantBusinessRoutes(app: FastifyInstance) {
  app.post('/v1/merchant/drivers/create', { preHandler: requireTenant(admins) }, async (req, reply) => {
    const tenantId = req.tenantContext!.tenantId;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const email = text(b.email).toLowerCase(), phone = text(b.phone).replace(/[\s()-]/g, '');
    const firstName = text(b.firstName), lastName = text(b.lastName);
    const password = typeof b.password === 'string' ? b.password : '';
    const branchId = text(b.branchId) || null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+?[0-9]{7,15}$/.test(phone) || !firstName || password.length < 8 || password.length > 128)
      return reply.code(400).send({ error: 'invalid_driver', message: 'Name, email, phone and an 8–128 character password are required.' });
    if (branchId && !await prisma.branch.findFirst({ where: { id: branchId, tenantId } })) return reply.code(400).send({ error: 'invalid_branch' });
    if (await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } })) return reply.code(409).send({ error: 'account_exists', message: 'This account already exists. Use Enroll existing driver.' });
    const passwordHash = await hashPassword(password);
    const driver = await prisma.$transaction(async tx => {
      const operator = await tx.deliveryOperator.upsert({ where: { tenantId }, update: {}, create: { tenantId, type: 'MERCHANT', name: `${req.tenantContext!.tenantName} delivery` } });
      const user = await tx.user.create({ data: { email, phone, firstName, lastName, passwordHash } });
      return tx.driver.create({ data: { userId: user.id, operatorId: operator.id, branchId, displayName: `${firstName} ${lastName}`.trim() }, include: { user: { select: driverUserSelect }, branch: true } });
    });
    return reply.code(201).send(driver);
  });

  app.patch('/v1/merchant/drivers/:driverId/details', { preHandler: requireTenant(admins) }, async (req, reply) => {
    const { driverId } = req.params as { driverId: string };
    const tenantId = req.tenantContext!.tenantId;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const driver = await prisma.driver.findFirst({ where: { id: driverId, operator: { tenantId } } });
    if (!driver) return reply.code(404).send({ error: 'driver_not_found' });
    const data: Prisma.DriverUpdateInput = {};
    if ('displayName' in b) { if (!text(b.displayName)) return reply.code(400).send({ error: 'name_required' }); data.displayName = text(b.displayName); }
    if ('vehiclePlate' in b) data.vehiclePlate = text(b.vehiclePlate, 30) || null;
    if ('vehicleType' in b) {
      if (!['MOTORCYCLE','BICYCLE','CAR','VAN','WALKING'].includes(String(b.vehicleType))) return reply.code(400).send({ error: 'invalid_vehicle_type' });
      data.vehicleType = String(b.vehicleType);
    }
    if ('maxConcurrentOrders' in b) {
      const capacity = Number(b.maxConcurrentOrders);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) return reply.code(400).send({ error: 'invalid_capacity', message: 'Capacity must be 1 to 20 orders.' });
      data.maxConcurrentOrders = capacity;
    }
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT 1 FROM "Driver" WHERE id = ${driverId} FOR UPDATE`;
      const active = await tx.delivery.count({ where: { driverId, status: { in: [...activeDelivery] } } });
      if (typeof data.maxConcurrentOrders === 'number' && data.maxConcurrentOrders < active) throw Object.assign(new Error('Capacity cannot be below current active deliveries.'), { statusCode: 409 });
      return tx.driver.update({ where: { id: driverId }, data, include: { user: { select: driverUserSelect }, branch: true } });
    });
  });

  for (const kind of ['categories', 'products'] as const) {
    app.patch(`/v1/merchant/${kind}/:id`, { preHandler: requireTenant(merchantWriteRoles) }, async (req, reply) => {
      const { id } = req.params as { id: string };
      const tenantId = req.tenantContext!.tenantId;
      const b = (req.body ?? {}) as Record<string, unknown>;
      const existing = kind === 'categories' ? await prisma.category.findFirst({ where: { id, tenantId, deletedAt: null } }) : await prisma.product.findFirst({ where: { id, tenantId, deletedAt: null } });
      if (!existing) return reply.code(404).send({ error: 'not_found' });
      const common: { name?: string; isActive?: boolean } = {};
      if ('name' in b) { if (!text(b.name)) return reply.code(400).send({ error: 'name_required' }); common.name = text(b.name); }
      if ('isActive' in b) { if (typeof b.isActive !== 'boolean') return reply.code(400).send({ error: 'invalid_status' }); common.isActive = b.isActive; }
      if (kind === 'categories') return prisma.category.update({ where: { id }, data: common });
      const data: Prisma.ProductUncheckedUpdateInput = { ...common };
      if ('price' in b) {
        const price = Number(b.price);
        if (b.price === null || b.price === '' || !Number.isFinite(price) || price < 0 || price > 100000000) return reply.code(400).send({ error: 'invalid_price' });
        data.price = price.toFixed(2);
      }
      if ('description' in b) data.description = text(b.description, 4000) || null;
      if ('isAvailable' in b) { if (typeof b.isAvailable !== 'boolean') return reply.code(400).send({ error: 'invalid_availability' }); data.isAvailable = b.isAvailable; }
      if ('categoryId' in b) {
        const categoryId = text(b.categoryId) || null;
        if (categoryId && !await prisma.category.findFirst({ where: { id: categoryId, tenantId, deletedAt: null } })) return reply.code(400).send({ error: 'invalid_category' });
        data.categoryId = categoryId;
      }
      if ('imageUrl' in b) {
        const url = text(b.imageUrl, 2000);
        // Only images created by the authenticated upload route can be assigned.
        if (url && !url.startsWith(`/v1/media/${tenantId}/`)) return reply.code(400).send({ error: 'upload_image_first' });
        data.imageUrl = url || null;
      }
      if ('options' in b) {
        if (!Array.isArray(b.options) || b.options.length > 20) return reply.code(400).send({ error: 'invalid_options' });
        const options = b.options as Record<string, unknown>[];
        if (new Set(options.map(o => o?.name)).size !== options.length || options.some(o => !o || !text(o.name) || !Number.isFinite(Number(o.price)) || Number(o.price) < 0 || Number(o.price) > 1000000)) return reply.code(400).send({ error: 'invalid_options' });
        data.options = options.map(o => ({ name: text(o.name), price: Number(o.price) }));
      }
      return prisma.product.update({ where: { id }, data });
    });
    app.delete(`/v1/merchant/${kind}/:id`, { preHandler: requireTenant(merchantWriteRoles) }, async (req, reply) => {
      const { id } = req.params as { id: string };
      const tenantId = req.tenantContext!.tenantId;
      // Tombstones preserve order history; deleted categories hide all their products.
      const result = kind === 'categories'
        ? await prisma.category.updateMany({ where: { id, tenantId, deletedAt: null }, data: { deletedAt: new Date(), isActive: false } })
        : await prisma.product.updateMany({ where: { id, tenantId, deletedAt: null }, data: { deletedAt: new Date(), isActive: false, isAvailable: false } });
      if (!result.count) return reply.code(404).send({ error: 'not_found' });
      return reply.code(204).send();
    });
  }

  app.patch('/v1/merchant/branches/:id/hours', { preHandler: requireTenant(admins) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!await prisma.branch.findFirst({ where: { id, tenantId: req.tenantContext!.tenantId } })) return reply.code(404).send({ error: 'branch_not_found' });
    const b = (req.body ?? {}) as Record<string, unknown>;
    const data: Prisma.BranchUpdateInput = {};
    if ('openingHours' in b) {
      if (b.openingHours !== null && !validateHours(b.openingHours)) return reply.code(400).send({ error: 'invalid_hours', message: 'Supply seven days (Monday first), each null or {open: "09:00", close: "18:00"}.' });
      data.openingHours = b.openingHours === null ? Prisma.DbNull : b.openingHours as Prisma.InputJsonValue;
    }
    if ('closedUntil' in b) {
      const date = b.closedUntil === null ? null : new Date(String(b.closedUntil));
      if (date && !Number.isFinite(date.getTime())) return reply.code(400).send({ error: 'invalid_closure' });
      data.closedUntil = date;
    }
    if (typeof b.isAcceptingOrders === 'boolean') data.isAcceptingOrders = b.isAcceptingOrders;
    return prisma.branch.update({ where: { id }, data });
  });
}
