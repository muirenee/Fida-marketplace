import { NextRequest, NextResponse } from 'next/server';
import { hasTrustedRuntimeOrigin } from '../../../../lib/request-origin';
import {
  backendBaseUrl,
  secureCookie,
  type AuthPayload,
} from '../../../../lib/backend';
const accessCookieName = 'fida_merchant_access';
const refreshCookieName = 'fida_merchant_refresh';

export async function POST(request: NextRequest) {
  if (!await hasTrustedRuntimeOrigin(request)) return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  const body = await request.text();
  const upstream = await fetch(`${backendBaseUrl}/v1/auth/login`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body,
    cache: 'no-store',
  });

  const text = await upstream.text();
  if (!upstream.ok) {
    return new NextResponse(text || JSON.stringify({ error: 'login_failed' }), {
      status: upstream.status,
      headers: { 'content-type': 'application/json' },
    });
  }

  const data = JSON.parse(text) as AuthPayload;
  const response = NextResponse.json({ user: data.user });
  response.cookies.set(accessCookieName, data.accessToken, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15,
  });
  response.cookies.set(refreshCookieName, data.refreshToken, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
