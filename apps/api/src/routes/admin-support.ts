import type { FastifyInstance } from 'fastify';
import { prisma } from '@fida/database/client';
import { requirePlatformAdmin } from '../lib/auth.js';

export async function adminSupportRoutes(app: FastifyInstance) {
  app.get('/v1/admin/support/users', { preHandler: requirePlatformAdmin }, async (request) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const search = typeof query.q === 'string' ? query.q.trim() : '';

    return prisma.user.findMany({
      where: search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isPlatformAdmin: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { customerOrders: true, memberships: true, addresses: true } },
        driver: { select: { id: true, isOnline: true, isAvailable: true, lastSeenAt: true } },
      },
      orderBy: [{ lastLoginAt: 'desc' }, { createdAt: 'desc' }],
      take: search ? 100 : 50,
    });
  });

  app.get('/v1/admin/support/users/:userId', { preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        isActive: true,
        isPlatformAdmin: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
          select: {
            id: true,
            label: true,
            addressLine: true,
            city: true,
            latitude: true,
            longitude: true,
            instructions: true,
            isDefault: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        memberships: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            createdAt: true,
            tenant: { select: { id: true, name: true, status: true, merchantType: true } },
            branch: { select: { id: true, name: true, city: true, isActive: true } },
          },
        },
        driver: {
          select: {
            id: true,
            isOnline: true,
            isAvailable: true,
            latitude: true,
            longitude: true,
            lastSeenAt: true,
            _count: { select: { deliveries: true } },
          },
        },
        customerOrders: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentMethod: true,
            paymentStatus: true,
            total: true,
            deliveryAddress: true,
            createdAt: true,
            tenant: { select: { id: true, name: true, currency: true } },
            branch: { select: { id: true, name: true, city: true } },
            delivery: {
              select: {
                status: true,
                deliveredAt: true,
                driver: {
                  select: {
                    user: { select: { firstName: true, lastName: true, email: true, phone: true } },
                  },
                },
              },
            },
            _count: { select: { items: true } },
          },
        },
      },
    });

    if (!user) return reply.code(404).send({ error: 'user_not_found' });
    return user;
  });
}
