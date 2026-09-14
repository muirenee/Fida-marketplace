import 'dotenv/config';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { prisma } from '../src/client.js';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('base64url');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$v1$${salt}$${derived.toString('base64url')}`;
}

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required for db:seed');
  }

  if (password.length < 12 || password.startsWith('replace-')) {
    throw new Error('SEED_ADMIN_PASSWORD must be changed from the example and contain at least 12 characters');
  }

  const passwordHash = await hashPassword(password);
  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      isActive: true,
      isPlatformAdmin: true,
    },
    create: {
      email,
      passwordHash,
      isActive: true,
      isPlatformAdmin: true,
      emailVerifiedAt: new Date(),
      firstName: 'Platform',
      lastName: 'Admin',
    },
    select: { id: true, email: true, isPlatformAdmin: true },
  });

  console.log('Seeded platform administrator:', admin);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
