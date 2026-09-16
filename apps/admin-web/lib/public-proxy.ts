import { NextRequest } from 'next/server';
import { backendBaseUrl } from './backend';

const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function forwardedHeaders(request: NextRequest) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (hopByHopHeaders.has(lower) || lower === 'host' || lower === 'content-length') return;
    headers.set(key, value);
  });

  return headers;
}

export async function proxyPublicRequest(request: NextRequest, pathname: string) {
  const target = new URL(`${backendBaseUrl}${pathname}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const upstream = await fetch(target, {
    method: request.method,
    headers: forwardedHeaders(request),
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: 'manual',
    cache: 'no-store',
  });

  const responseHeaders = new Headers(upstream.headers);
  for (const header of hopByHopHeaders) responseHeaders.delete(header);
  responseHeaders.delete('content-length');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
