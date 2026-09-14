import Fastify from 'fastify';
import cors from '@fastify/cors';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get('/health', async () => ({
  service: 'fida-marketplace-api',
  status: 'ok',
  version: '0.1.0',
}));

app.get('/v1', async () => ({
  name: 'Fida Marketplace API',
  milestone: 'multi-tenant-foundation',
}));

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: '0.0.0.0' });
