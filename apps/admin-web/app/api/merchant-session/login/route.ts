import { NextRequest, NextResponse } from 'next/server';
import {
  backendBaseUrl,
  secureCookie,
  type AuthPayload,
} from '../../../../lib/backend';
const accessCookieName = 'fida_merchant_access';
const refreshCookieName = 'fida_merchant_refresh';

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!origin || new URL(origin).host !== host) return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
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
  const me = await fetch(`${backendBaseUrl}/v1/auth/me`, { headers: { authorization: `Bearer ${data.accessToken}` }, cache: 'no-store' });
  const profile = await me.json() as { memberships?: unknown[] };
  if (!me.ok || !profile.memberships?.length) {
    await fetch(`${backendBaseUrl}/v1/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: data.refreshToken }),
      cache: 'no-store',
    }).catch(() => undefined);
    return NextResponse.json({ error: 'merchant_membership_required' }, { status: 403 });
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
