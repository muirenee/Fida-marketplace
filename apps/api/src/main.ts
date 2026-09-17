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
import { driverRoutes } from './routes/driver.js';
import { marketplaceRoutes } from './routes/marketplace.js';
import { merchantRoutes } from './routes/merchant.js';
import { orderRoutes } from './routes/orders.js';
import { tenantRoutes } from './routes/tenants.js';

const jwtSecret = process.env.JWT_ACCESS_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_ACCESS_SECRET must be configured with at least 32 characters');
}

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((value) => value.trim()) : true,
  credentials: true,
});
await app.register(jwt, { secret: jwtSecret });
registerAdminAudit(app);
registerAdminGuardrails(app);

await app.register(authRoutes);
await app.register(marketplaceRoutes);
await app.register(addressRoutes);
await app.register(orderRoutes);
await app.register(driverRoutes);
await app.register(tenantRoutes);
await app.register(merchantRoutes);
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

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: '0.0.0.0' });
