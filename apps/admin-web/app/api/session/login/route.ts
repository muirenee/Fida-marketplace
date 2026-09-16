import { NextRequest, NextResponse } from 'next/server';
import {
  accessCookieName,
  backendBaseUrl,
  refreshCookieName,
  secureCookie,
  type AuthPayload,
} from '../../../../lib/backend';

export async function POST(request: NextRequest) {
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
  if (!data.user?.isPlatformAdmin) {
    await fetch(`${backendBaseUrl}/v1/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: data.refreshToken }),
      cache: 'no-store',
    }).catch(() => undefined);
    return NextResponse.json({ error: 'platform_admin_required' }, { status: 403 });
  }

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
