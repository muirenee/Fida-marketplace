import { NextRequest, NextResponse } from 'next/server';
import {
  backendBaseUrl,
  refreshAdminSession,
  secureCookie,
} from '../../../../lib/backend';
const accessCookieName = 'fida_merchant_access';
const refreshCookieName = 'fida_merchant_refresh';

async function fetchMe(accessToken: string) {
  return fetch(`${backendBaseUrl}/v1/auth/me`, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });
}

export async function GET(request: NextRequest) {
  let accessToken = request.cookies.get(accessCookieName)?.value;
  const refreshToken = request.cookies.get(refreshCookieName)?.value;
  let refreshed: Awaited<ReturnType<typeof refreshAdminSession>> = null;

  if (!accessToken && refreshToken) {
    refreshed = await refreshAdminSession(refreshToken);
    accessToken = refreshed?.accessToken;
  }

  if (!accessToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let upstream = await fetchMe(accessToken);
  if (upstream.status === 401 && refreshToken) {
    refreshed = await refreshAdminSession(refreshToken);
    if (refreshed?.accessToken) {
      accessToken = refreshed.accessToken;
      upstream = await fetchMe(accessToken);
    }
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: 'unauthorized' }, { status: upstream.status === 403 ? 403 : 401 });
  }

  const payload = (await upstream.json()) as { memberships?: unknown[] };
  const response = NextResponse.json(payload);
  if (refreshed) {
    response.cookies.set(accessCookieName, refreshed.accessToken, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 15,
    });
    response.cookies.set(refreshCookieName, refreshed.refreshToken, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}
