import { NextRequest } from 'next/server';
import { proxyPublicRequest } from '../../lib/public-proxy';

export async function GET(request: NextRequest) {
  return proxyPublicRequest(request, '/health');
}

export async function HEAD(request: NextRequest) {
  return proxyPublicRequest(request, '/health');
}
