import type { FastifyInstance } from 'fastify';
import { prisma } from '@fida/database/client';
import { requirePlatformAdmin } from '../lib/auth.js';

function parseDate(value: unknown, endOfDay = false) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const raw = value.trim();
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z` : raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function adminAuditRoutes(app: FastifyInstance) {
  app.get('/v1/admin/audit', { preHandler: requirePlatformAdmin }, async (request) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    const action = typeof query.action === 'string' ? query.action.trim() : '';
    const targetType = typeof query.targetType === 'string' ? query.targetType.trim() : '';
    const actorUserId = typeof query.actorUserId === 'string' ? query.actorUserId.trim() : '';
    const tenantId = typeof query.tenantId === 'string' ? query.tenantId.trim() : '';
    const from = parseDate(query.from);
    const to = parseDate(query.to, true);
    const success = query.success === 'true' ? true : query.success === 'false' ? false : undefined;
    const requestedLimit = Number(query.limit ?? 150);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 300) : 150;

    return prisma.adminAuditEvent.findMany({
      where: {
        ...(action ? { action } : {}),
        ...(targetType ? { targetType } : {}),
        ...(actorUserId ? { actorUserId } : {}),
        ...(tenantId ? { tenantId } : {}),
        ...(success === undefined ? {} : { success }),
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
        ...(q
          ? {
              OR: [
                { actorEmail: { contains: q, mode: 'insensitive' as const } },
                { action: { contains: q, mode: 'insensitive' as const } },
                { targetType: { contains: q, mode: 'insensitive' as const } },
                { targetId: { contains: q, mode: 'insensitive' as const } },
                { route: { contains: q, mode: 'insensitive' as const } },
                { path: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  });

  app.get('/v1/admin/audit/summary', { preHandler: requirePlatformAdmin }, async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [total24h, successful24h, failed24h, actors, actions] = await Promise.all([
      prisma.adminAuditEvent.count({ where: { createdAt: { gte: since } } }),
      prisma.adminAuditEvent.count({ where: { createdAt: { gte: since }, success: true } }),
      prisma.adminAuditEvent.count({ where: { createdAt: { gte: since }, success: false } }),
      prisma.adminAuditEvent.findMany({
        where: { createdAt: { gte: since }, actorUserId: { not: null } },
        distinct: ['actorUserId'],
        select: { actorUserId: true },
      }),
      prisma.adminAuditEvent.groupBy({
        by: ['action'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { action: 'desc' } },
        take: 6,
      }),
    ]);

    return {
      total24h,
      successful24h,
      failed24h,
      actors24h: actors.length,
      topActions: actions.map((row) => ({ action: row.action, total: row._count._all })),
    };
  });
}
