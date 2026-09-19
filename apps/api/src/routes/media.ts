import type { FastifyInstance } from 'fastify';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { merchantWriteRoles, requireTenant } from '../lib/tenant.js';
const root = resolve(process.env.MEDIA_DIRECTORY ?? './uploads');
export async function mediaRoutes(app: FastifyInstance) {
  app.post('/v1/merchant/media', { bodyLimit: 7 * 1024 * 1024, preHandler: requireTenant(merchantWriteRoles) }, async (req, reply) => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (typeof b.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(b.base64)) return reply.code(400).send({ error: 'invalid_image' });
    const bytes = Buffer.from(b.base64, 'base64');
    if (bytes.length < 12 || bytes.length > 5 * 1024 * 1024) return reply.code(400).send({ error: 'image_size', message: 'Choose a JPEG, PNG or WebP image smaller than 5 MB.' });
    const ext = bytes.subarray(0,3).equals(Buffer.from([255,216,255])) ? 'jpg' : bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png' : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP' ? 'webp' : null;
    if (!ext) return reply.code(400).send({ error: 'unsupported_image' });
    const tenantId = req.tenantContext!.tenantId;
    const directory = resolve(root, tenantId);
    await mkdir(directory, { recursive: true });
    const file = `${randomUUID()}.${ext}`;
    await writeFile(resolve(directory, file), bytes, { flag: 'wx' });
    return reply.code(201).send({ url: `/v1/media/${tenantId}/${file}` });
  });
  app.get('/v1/media/:tenant/:file', async (req, reply) => {
    const { tenant, file } = req.params as { tenant: string; file: string };
    if (!/^[a-zA-Z0-9_-]+$/.test(tenant) || !/^[a-f0-9-]{36}\.(jpg|png|webp)$/.test(file)) return reply.code(404).send();
    try {
      const data = await readFile(resolve(root, tenant, file));
      return reply.header('cache-control','public, max-age=31536000, immutable').header('x-content-type-options','nosniff').type(file.endsWith('.jpg') ? 'image/jpeg' : file.endsWith('.png') ? 'image/png' : 'image/webp').send(data);
    } catch { return reply.code(404).send(); }
  });
}
