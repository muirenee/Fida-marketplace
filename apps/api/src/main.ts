import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { addressRoutes } from './routes/addresses.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
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

await app.register(authRoutes);
await app.register(marketplaceRoutes);
await app.register(addressRoutes);
await app.register(orderRoutes);
await app.register(tenantRoutes);
await app.register(merchantRoutes);
await app.register(adminRoutes);

app.get('/health', async () => ({
  service: 'fida-marketplace-api',
  status: 'ok',
  version: '0.3.0',
}));

app.get('/v1', async () => ({
  name: 'Fida Marketplace API',
  milestone: 'marketplace-ordering',
}));

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: '0.0.0.0' });
