export const accessCookieName = 'fida_admin_access';
export const refreshCookieName = 'fida_admin_refresh';

export const backendBaseUrl = (
  process.env.FIDA_API_BASE_URL ??
  process.env.NEXT_PUBLIC_FIDA_API_BASE_URL ??
  'http://api:3001'
).replace(/\/$/, '');

export const secureCookie = process.env.NODE_ENV === 'production';

export type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user?: {
    id: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    isPlatformAdmin?: boolean;
  };
};

export async function refreshAdminSession(refreshToken: string): Promise<AuthPayload | null> {
  const response = await fetch(`${backendBaseUrl}/v1/auth/refresh`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  });

  if (!response.ok) return null;
  return (await response.json()) as AuthPayload;
}
