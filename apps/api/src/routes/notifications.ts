import type { FastifyInstance } from 'fastify';
import { prisma } from '@fida/database/client';
import { authenticate } from '../lib/auth.js';
import { pushConfigured } from '../lib/notifications.js';
export async function notificationRoutes(app: FastifyInstance) {
 app.get('/v1/notifications/status', { preHandler: authenticate }, async () => ({ configured: pushConfigured() }));
 app.post('/v1/notifications/devices', { preHandler: authenticate }, async (req,reply) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  if (typeof b.token !== 'string' || b.token.length < 20 || b.token.length > 4096 || !['customer','merchant','driver'].includes(String(b.app))) return reply.code(400).send({ error: 'invalid_device' });
  if (b.app === 'merchant' && !await prisma.tenantMembership.count({ where: { userId: req.authUser!.id } })) return reply.code(403).send({ error: 'membership_required' });
  if (b.app === 'driver' && !await prisma.driver.count({ where: { userId: req.authUser!.id, isActive: true } })) return reply.code(403).send({ error: 'driver_required' });
  await prisma.deviceToken.upsert({ where: { token: b.token }, update: { userId: req.authUser!.id, app: String(b.app) }, create: { token: b.token, userId: req.authUser!.id, app: String(b.app) } });
  return { registered: true };
 });
 app.delete('/v1/notifications/devices', { preHandler: authenticate }, async (req,reply) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  if (typeof b.token !== 'string') return reply.code(400).send({ error: 'token_required' });
  await prisma.deviceToken.deleteMany({ where: { token: b.token, userId: req.authUser!.id } });
  return reply.code(204).send();
 });
}
