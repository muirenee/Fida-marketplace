import { NextRequest, NextResponse } from 'next/server';
import { hasTrustedOrigin } from '../../../../lib/request-origin';
import {
  backendBaseUrl,
  refreshAdminSession,
  secureCookie,
} from '../../../../lib/backend';

const accessCookieName = 'fida_merchant_access';
const refreshCookieName = 'fida_merchant_refresh';

type Context = { params: Promise<{ path: string[] }> };

async function forward(
  request: NextRequest,
  context: Context,
  accessToken: string,
  bodyText: ArrayBuffer | null,
) {
  const { path } = await context.params;
  if (path.some(p => !/^[a-zA-Z0-9_-]+$/.test(p))) return new Response(JSON.stringify({ error: 'invalid_path' }), { status: 400 });
  const target = new URL(`${backendBaseUrl}/v1/merchant/${path.join('/')}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));

  const headers: Record<string, string> = {
    'x-tenant-id': request.headers.get('x-tenant-id') ?? '',
    accept: 'application/json',
    authorization: `Bearer ${accessToken}`,
  };
  if (bodyText) headers['content-type'] = request.headers.get('content-type') ?? 'application/json';

  return fetch(target, {
    method: request.method,
    headers,
    body: bodyText || undefined,
    cache: 'no-store',
  });
}

async function handler(request: NextRequest, context: Context) {
  if (request.method !== 'GET' && !hasTrustedOrigin(request)) return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  let accessToken = request.cookies.get(accessCookieName)?.value;
  const refreshToken = request.cookies.get(refreshCookieName)?.value;
  let bodyText:ArrayBuffer|null=null;
  if(request.method!=='GET'&&request.method!=='HEAD'&&request.body){
    const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>7*1024*1024){await reader.cancel();return NextResponse.json({error:'body_too_large'},{status:413});}chunks.push(part.value);}
    if(size){const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}bodyText=bytes.buffer;}
  }
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

export const PUT = handler;
