import type { FastifyInstance } from 'fastify';
import { prisma } from '@fida/database/client';
import { hashRefreshToken, newRefreshToken, refreshExpiry } from './security.js';

export function signAccessToken(app: FastifyInstance, user: { id: string; isPlatformAdmin: boolean }) {
  return app.jwt.sign(
    {
      sub: user.id,
      type: 'access',
      isPlatformAdmin: user.isPlatformAdmin,
    },
    { expiresIn: process.env.JWT_ACCESS_TTL ?? '15m' },
  );
}

export async function createRefreshSession(userId: string) {
  const refreshToken = newRefreshToken();
  const expiresAt = refreshExpiry();

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt,
    },
  });

  return { refreshToken, refreshExpiresAt: expiresAt };
}
