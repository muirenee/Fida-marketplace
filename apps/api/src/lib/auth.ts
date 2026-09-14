import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@fida/database/client';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'unauthorized', message: 'A valid access token is required.' });
  }

  if (request.user.type !== 'access') {
    return reply.code(401).send({ error: 'unauthorized', message: 'Invalid token type.' });
  }

  const user = await prisma.user.findUnique({
    where: { id: request.user.sub },
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      isActive: true,
      isPlatformAdmin: true,
    },
  });

  if (!user?.isActive) {
    return reply.code(401).send({ error: 'unauthorized', message: 'User account is inactive.' });
  }

  request.authUser = {
    id: user.id,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    isPlatformAdmin: user.isPlatformAdmin,
  };
}

export async function requirePlatformAdmin(request: FastifyRequest, reply: FastifyReply) {
  await authenticate(request, reply);
  if (reply.sent) return;

  if (!request.authUser?.isPlatformAdmin) {
    return reply.code(403).send({ error: 'forbidden', message: 'Platform administrator access is required.' });
  }
}
