import { businessOperationsRoutes } from './routes/business-operations.js';
import { paymentRoutes } from './routes/payments.js';
import { growthRoutes } from './routes/growth.js';
import { notificationRoutes } from './routes/notifications.js';
import { startNotificationWorker } from './lib/notifications.js';
import { merchantBusinessRoutes } from './routes/merchant-business.js';
import { mediaRoutes } from './routes/media.js';
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { registerAdminAudit } from './lib/admin-audit.js';
import { registerAdminGuardrails } from './lib/admin-guardrails.js';
import { addressRoutes } from './routes/addresses.js';
import { adminAuditRoutes } from './routes/admin-audit.js';
import { adminCatalogRoutes } from './routes/admin-catalog.js';
import { adminFinanceRoutes } from './routes/admin-finance.js';
import { adminInsightRoutes } from './routes/admin-insights.js';
import { adminOperationsRoutes } from './routes/admin-operations.js';
import { adminProvisioningRoutes } from './routes/admin-provisioning.js';
import { adminReportRoutes } from './routes/admin-reports.js';
import { adminSupportRoutes } from './routes/admin-support.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { deliveryQuoteRoutes } from './routes/delivery-quote.js';
import { driverRoutes } from './routes/driver.js';
import { marketplaceRoutes } from './routes/marketplace.js';
import { merchantRoutes } from './routes/merchant.js';
import { orderRoutes } from './routes/orders.js';
import { tenantRoutes } from './routes/tenants.js';


export async function buildServer() {
const jwtSecret = process.env.JWT_ACCESS_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_ACCESS_SECRET must be configured with at least 32 characters');
}

const app = Fastify({ logger: process.env.APP_ENV !== 'test' });
app.setErrorHandler((error, request, reply) => {
  const e = error as { code?: string; statusCode?: number; message?: string };
  if (e.code === 'P2002') return reply.code(409).send({ error: 'already_exists', message: 'An item with these details already exists.' });
  if (e.code === 'P2034') return reply.code(409).send({ error: 'concurrent_update', message: 'This item changed. Refresh and try again.' });
  if (e.statusCode && e.statusCode < 500) return reply.code(e.statusCode).send({ error: e.code ?? 'invalid_request', message: e.message });
  request.log.error(error);
  if (process.env.APP_ENV === 'test') console.error(error);
  return reply.code(500).send({ error: 'server_error', message: 'Unable to complete this request.' });
});

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((value) => value.trim()) : true,
  credentials: true,
});
await app.register(jwt, { secret: jwtSecret });
// Bounded, per-process abuse protection. Deploy behind a trusted rate-limiting proxy for multi-replica limits.
const attempts = new Map<string,{count:number;reset:number}>();
app.addHook('preHandler', async(request,reply)=>{
  if(request.method==='GET'||request.method==='OPTIONS')return;
  const route=request.routeOptions.url??request.url;
  const sensitive=route.startsWith('/v1/auth/')||route.includes('/status');
  const key=`${request.authUser?.id??request.ip}:${route}`;
  const now=Date.now();
  if(attempts.size>10000){for(const [k,v] of attempts)if(v.reset<=now)attempts.delete(k);}
  if(attempts.size>10000&&!attempts.has(key))return reply.code(429).send({error:'too_many_requests'});
  let entry=attempts.get(key);if(!entry||entry.reset<=now){entry={count:0,reset:now+(sensitive?60000:60000)};attempts.set(key,entry);}
  entry.count++;
  if(entry.count>(sensitive?20:120))return reply.header('retry-after',Math.ceil((entry.reset-now)/1000)).code(429).send({error:'too_many_requests',message:'Please wait before trying again.'});
});
registerAdminAudit(app);
registerAdminGuardrails(app);

await app.register(authRoutes);
await app.register(marketplaceRoutes);
await app.register(addressRoutes);
await app.register(deliveryQuoteRoutes);
await app.register(orderRoutes);
await app.register(driverRoutes);
await app.register(tenantRoutes);
await app.register(merchantRoutes);
await app.register(merchantBusinessRoutes);
await app.register(mediaRoutes);
await app.register(businessOperationsRoutes);
await app.register(paymentRoutes);
await app.register(growthRoutes);
await app.register(notificationRoutes);
if (process.env.APP_ENV !== 'test') startNotificationWorker(app);
await app.register(adminRoutes);
await app.register(adminCatalogRoutes);
await app.register(adminOperationsRoutes);
await app.register(adminProvisioningRoutes);
await app.register(adminFinanceRoutes);
await app.register(adminSupportRoutes);
await app.register(adminReportRoutes);
await app.register(adminInsightRoutes);
await app.register(adminAuditRoutes);

app.get('/health', async () => ({
  service: 'fida-marketplace-api',
  status: 'ok',
  version: '0.4.0',
}));

app.get('/v1', async () => ({
  name: 'Fida Marketplace API',
  milestone: 'customer-merchant-driver-flow',
}));


return app;
}
