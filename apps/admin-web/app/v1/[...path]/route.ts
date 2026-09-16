import { NextRequest } from 'next/server';
import { proxyPublicRequest } from '../../../lib/public-proxy';

type Context = { params: Promise<{ path: string[] }> };

async function handler(request: NextRequest, context: Context) {
  const { path } = await context.params;
  return proxyPublicRequest(request, `/v1/${path.join('/')}`);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
export const HEAD = handler;
