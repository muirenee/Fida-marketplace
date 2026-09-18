import type { FastifyInstance } from 'fastify';
import { prisma } from '@fida/database/client';
import { authenticate } from '../lib/auth.js';
import { fcmConfigured } from '../lib/fcm.js';

const apps = ['CUSTOMER', 'MERCHANT', 'DRIVER'] as const;
const platforms = ['ANDROID', 'IOS'] as const;

export async function pushRoutes(app: FastifyInstance) {
  app.post('/v1/push/devices', { preHandler: authenticate }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const appName = typeof body.app === 'string' ? body.app.toUpperCase() : '';
    const platform = typeof body.platform === 'string' ? body.platform.toUpperCase() : 'ANDROID';

    if (!token || token.length < 20 || token.length > 4096) {
      return reply.code(400).send({ error: 'invalid_push_token' });
    }
    if (!apps.includes(appName as (typeof apps)[number])) {
      return reply.code(400).send({ error: 'invalid_push_app', allowed: apps });
    }
    if (!platforms.includes(platform as (typeof platforms)[number])) {
      return reply.code(400).send({ error: 'invalid_push_platform', allowed: platforms });
    }

    const device = await prisma.pushDevice.upsert({
      where: { token },
      update: {
        userId: request.authUser!.id,
        app: appName,
        platform,
        isActive: true,
        lastSeenAt: new Date(),
      },
      create: {
        userId: request.authUser!.id,
        app: appName,
        platform,
        token,
      },
      select: { id: true, app: true, platform: true, isActive: true, lastSeenAt: true },
    });

    return device;
  });

  app.post('/v1/push/devices/unregister', { preHandler: authenticate }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!token) return reply.code(400).send({ error: 'push_token_required' });

    await prisma.pushDevice.updateMany({
      where: { token, userId: request.authUser!.id },
      data: { isActive: false },
    });
    return { success: true };
  });

  app.get('/v1/push/status', { preHandler: authenticate }, async (request) => {
    const devices = await prisma.pushDevice.count({ where: { userId: request.authUser!.id, isActive: true } });
    return { providerConfigured: fcmConfigured(), activeDevices: devices };
  });
}
