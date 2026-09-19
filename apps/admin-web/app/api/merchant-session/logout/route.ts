import { NextRequest, NextResponse } from 'next/server';
import { hasTrustedOrigin } from '../../../../lib/request-origin';
import {
  backendBaseUrl,
} from '../../../../lib/backend';
const accessCookieName = 'fida_merchant_access';
const refreshCookieName = 'fida_merchant_refresh';

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
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
