import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8 || password.length > 128) {
    throw new Error('Password must be between 8 and 128 characters');
  }

  const salt = randomBytes(16).toString('base64url');
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$v1$${salt}$${derivedKey.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, version, salt, storedKey] = encoded.split('$');
  if (algorithm !== 'scrypt' || version !== 'v1' || !salt || !storedKey) return false;

  const stored = Buffer.from(storedKey, 'base64url');
  const derived = (await scryptAsync(password, salt, stored.length)) as Buffer;
  return stored.length === derived.length && timingSafeEqual(stored, derived);
}

export function newRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshExpiry(): Date {
  const days = Number(process.env.REFRESH_TOKEN_DAYS ?? 30);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
