import { NextRequest, NextResponse } from 'next/server';
import {
  accessCookieName,
  backendBaseUrl,
  refreshCookieName,
} from '../../../../lib/backend';

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(refreshCookieName)?.value;

  if (refreshToken) {
    await fetch(`${backendBaseUrl}/v1/auth/logout`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(accessCookieName, '', { httpOnly: true, path: '/', maxAge: 0 });
  response.cookies.set(refreshCookieName, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
