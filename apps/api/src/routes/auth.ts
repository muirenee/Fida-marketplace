import type { FastifyInstance } from 'fastify';
import { prisma } from '@fida/database/client';
import { authenticate } from '../lib/auth.js';
import { createRefreshSession, signAccessToken } from '../lib/session.js';
import {
  hashPassword,
  hashRefreshToken,
  newRefreshToken,
  refreshExpiry,
  verifyPassword,
} from '../lib/security.js';

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return `${hasPlus ? '+' : ''}${digits}`;
}

function publicUser(user: {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  isPlatformAdmin: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    isPlatformAdmin: user.isPlatformAdmin,
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/v1/auth/register', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email) {
      return reply.code(400).send({ error: 'invalid_email', message: 'A valid email address is required.' });
    }

    if (!phone) {
      return reply.code(400).send({ error: 'invalid_phone', message: 'A valid customer phone number is required.' });
    }

    if (password.length < 8 || password.length > 128) {
      return reply.code(400).send({
        error: 'invalid_password',
        message: 'Password must be between 8 and 128 characters.',
      });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
      select: { email: true, phone: true },
    });
    if (existing?.email === email) {
      return reply.code(409).send({ error: 'email_in_use', message: 'An account already exists for this email.' });
    }
    if (existing?.phone === phone) {
      return reply.code(409).send({ error: 'phone_in_use', message: 'An account already exists for this phone number.' });
    }

    const user = await prisma.user.create({
      data: {
        email,
        phone,
        passwordHash: await hashPassword(password),
        firstName: typeof body.firstName === 'string' ? body.firstName.trim() || null : null,
        lastName: typeof body.lastName === 'string' ? body.lastName.trim() || null : null,
      },
    });

    const session = await createRefreshSession(user.id);
    const accessToken = signAccessToken(app, user);

    return reply.code(201).send({
      user: publicUser(user),
      accessToken,
      refreshToken: session.refreshToken,
      refreshExpiresAt: session.refreshExpiresAt,
    });
  });

  app.post('/v1/auth/login', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const email = normalizeEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return reply.code(401).send({ error: 'invalid_credentials', message: 'Invalid email or password.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
      return reply.code(401).send({ error: 'invalid_credentials', message: 'Invalid email or password.' });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const session = await createRefreshSession(user.id);
    const accessToken = signAccessToken(app, user);

    return {
      user: publicUser(user),
      accessToken,
      refreshToken: session.refreshToken,
      refreshExpiresAt: session.refreshExpiresAt,
    };
  });

  app.post('/v1/auth/refresh', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';

    if (!refreshToken) {
      return reply.code(400).send({ error: 'refresh_token_required' });
    }

    const tokenHash = hashRefreshToken(refreshToken);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.isActive
    ) {
      return reply.code(401).send({ error: 'invalid_refresh_token' });
    }

    const nextRefreshToken = newRefreshToken();
    const nextExpiresAt = refreshExpiry();

    await prisma.$transaction([
      prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      }),
      prisma.session.create({
        data: {
          userId: session.userId,
          tokenHash: hashRefreshToken(nextRefreshToken),
          expiresAt: nextExpiresAt,
        },
      }),
    ]);

    return {
      accessToken: signAccessToken(app, session.user),
      refreshToken: nextRefreshToken,
      refreshExpiresAt: nextExpiresAt,
    };
  });

  app.post('/v1/auth/logout', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';

    if (refreshToken) {
      await prisma.session.updateMany({
        where: { tokenHash: hashRefreshToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return reply.code(204).send();
  });

  app.patch('/v1/auth/me', { preHandler: authenticate }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const phone = normalizePhone(body.phone);
    if (!phone) {
      return reply.code(400).send({ error: 'invalid_phone', message: 'A valid customer phone number is required.' });
    }

    const existing = await prisma.user.findFirst({
      where: { phone, NOT: { id: request.authUser!.id } },
      select: { id: true },
    });
    if (existing) {
      return reply.code(409).send({ error: 'phone_in_use', message: 'This phone number is already used by another account.' });
    }

    const user = await prisma.user.update({
      where: { id: request.authUser!.id },
      data: { phone },
    });
    return { user: publicUser(user) };
  });

  app.get('/v1/auth/me', { preHandler: authenticate }, async (request) => {
    const memberships = await prisma.tenantMembership.findMany({
      where: { userId: request.authUser!.id },
      select: {
        role: true,
        branchId: true,
        tenant: {
          select: { id: true, name: true, slug: true, status: true, merchantType: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      user: request.authUser,
      memberships,
    };
  });
}
