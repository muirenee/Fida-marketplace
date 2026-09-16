import { NextRequest, NextResponse } from 'next/server';
import {
  accessCookieName,
  backendBaseUrl,
  refreshAdminSession,
  refreshCookieName,
  secureCookie,
} from '../../../../lib/backend';

type Context = { params: Promise<{ path: string[] }> };

async function forward(
  request: NextRequest,
  context: Context,
  accessToken: string,
  bodyText: string | null,
) {
  const { path } = await context.params;
  const target = new URL(`${backendBaseUrl}/v1/admin/${path.join('/')}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));

  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${accessToken}`,
  };
  if (bodyText) headers['content-type'] = 'application/json';

  return fetch(target, {
    method: request.method,
    headers,
    body: bodyText || undefined,
    cache: 'no-store',
  });
}

async function handler(request: NextRequest, context: Context) {
  let accessToken = request.cookies.get(accessCookieName)?.value;
  const refreshToken = request.cookies.get(refreshCookieName)?.value;
  const bodyText = request.method === 'GET' || request.method === 'HEAD' ? null : await request.text();
  let refreshed: Awaited<ReturnType<typeof refreshAdminSession>> = null;

  if (!accessToken && refreshToken) {
    refreshed = await refreshAdminSession(refreshToken);
    accessToken = refreshed?.accessToken;
  }

  if (!accessToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let upstream = await forward(request, context, accessToken, bodyText);
  if (upstream.status === 401 && refreshToken) {
    refreshed = await refreshAdminSession(refreshToken);
    if (refreshed?.accessToken) {
      accessToken = refreshed.accessToken;
      upstream = await forward(request, context, accessToken, bodyText);
    }
  }

  const payload = await upstream.text();
  const response = new NextResponse(payload || null, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    },
  });

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

  if (upstream.status === 401) {
    response.cookies.set(accessCookieName, '', { httpOnly: true, path: '/', maxAge: 0 });
    response.cookies.set(refreshCookieName, '', { httpOnly: true, path: '/', maxAge: 0 });
  }

  return response;
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
