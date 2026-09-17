import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Prisma, prisma } from '@fida/database/client';

const sensitiveKey = /(password|secret|token|authorization|cookie|credential)/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  if (typeof value !== 'object') return value;

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = sensitiveKey.test(key) ? '[redacted]' : sanitize(item, depth + 1);
  }
  return output;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(sanitize(value))) as Prisma.InputJsonValue;
}

function stringParam(params: unknown, key: string) {
  const value = (params as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' && value ? value : undefined;
}

function stringBody(body: unknown, key: string) {
  const value = (body as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' && value ? value : undefined;
}

function classify(request: FastifyRequest) {
  const route = request.routeOptions.url ?? request.url.split('?')[0] ?? request.url;
  const method = request.method.toUpperCase();
  const params = request.params;
  const body = request.body;

  const catalogProductId = stringParam(params, 'productId');
  const categoryId = stringParam(params, 'categoryId');
  const tenantId = stringParam(params, 'tenantId') ?? stringBody(body, 'tenantId');
  const userId = stringParam(params, 'userId') ?? stringBody(body, 'userId');
  const driverId = stringParam(params, 'driverId');
  const branchId = stringParam(params, 'branchId');
  const membershipId = stringParam(params, 'membershipId');

  if (route.includes('/catalog/products/:productId')) {
    return { action: 'CATALOG_PRODUCT_UPDATE', targetType: 'PRODUCT', targetId: catalogProductId, tenantId };
  }
  if (route.includes('/catalog/categories/:categoryId/active')) {
    return { action: 'CATALOG_CATEGORY_VISIBILITY_UPDATE', targetType: 'CATEGORY', targetId: categoryId, tenantId };
  }
  if (route.includes('/tenants/:tenantId/settings')) {
    return { action: 'MERCHANT_SETTINGS_UPDATE', targetType: 'TENANT', targetId: tenantId, tenantId };
  }
  if (route.includes('/tenants/:tenantId/status')) {
    return { action: 'MERCHANT_STATUS_UPDATE', targetType: 'TENANT', targetId: tenantId, tenantId };
  }
  if (route.includes('/users/:userId/active')) {
    return { action: 'USER_ACCESS_UPDATE', targetType: 'USER', targetId: userId, tenantId };
  }
  if (route.includes('/drivers/:driverId/state')) {
    return { action: 'DRIVER_STATE_UPDATE', targetType: 'DRIVER', targetId: driverId, tenantId };
  }
  if (route.endsWith('/drivers') && method === 'POST') {
    return { action: 'DRIVER_APPROVAL', targetType: 'DRIVER', targetId: userId, tenantId };
  }
  if (route.includes('/branches/:branchId')) {
    return { action: 'BRANCH_UPDATE', targetType: 'BRANCH', targetId: branchId, tenantId };
  }
  if (route.endsWith('/branches') && method === 'POST') {
    return { action: 'BRANCH_CREATE', targetType: 'BRANCH', targetId: branchId, tenantId };
  }
  if (route.includes('/memberships/:membershipId')) {
    return { action: 'MERCHANT_STAFF_UPDATE', targetType: 'MEMBERSHIP', targetId: membershipId, tenantId };
  }
  if (route.endsWith('/memberships') && method === 'POST') {
    return { action: 'MERCHANT_STAFF_ASSIGN', targetType: 'MEMBERSHIP', targetId: userId, tenantId };
  }

  const action = `${method}_${route.replace(/^\/v1\/admin\/?/, '').replace(/[:/]+/g, '_').replace(/[^A-Za-z0-9_]/g, '').toUpperCase() || 'ADMIN'}`;
  return { action, targetType: undefined, targetId: undefined, tenantId };
}

export function registerAdminAudit(app: FastifyInstance) {
  app.addHook('onResponse', async (request, reply) => {
    if (!request.url.startsWith('/v1/admin/')) return;
    if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return;
    if (!request.authUser?.isPlatformAdmin) return;

    const route = request.routeOptions.url ?? request.url.split('?')[0] ?? request.url;
    const classification = classify(request);
    const statusCode = reply.statusCode;

    try {
      await prisma.adminAuditEvent.create({
        data: {
          actorUserId: request.authUser.id,
          actorEmail: request.authUser.email,
          method: request.method.toUpperCase(),
          route,
          path: request.url.split('?')[0] ?? request.url,
          action: classification.action,
          targetType: classification.targetType,
          targetId: classification.targetId,
          tenantId: classification.tenantId,
          statusCode,
          success: statusCode >= 200 && statusCode < 400,
          changes: request.body === undefined ? undefined : asJson(request.body),
          metadata: asJson({
            params: sanitize(request.params),
            query: sanitize(request.query),
          }),
          ipAddress: request.ip,
          userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
        },
      });
    } catch (error) {
      request.log.error({ error }, 'unable to write admin audit event');
    }
  });
}
