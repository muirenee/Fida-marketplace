import { buildServer } from './server.js';
const app = await buildServer();
await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' });
