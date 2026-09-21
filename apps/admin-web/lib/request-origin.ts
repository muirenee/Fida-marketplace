/** Validate browser mutations against the configured external URL behind a proxy. */
export function hasTrustedOrigin(
  request: { headers: Headers; url: string },
  publicBaseUrl = process.env.PUBLIC_BASE_URL,
): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    // Never derive the trusted origin from client-supplied forwarding headers.
    // Without an external URL, direct/local deployments use the request URL.
    const expected = new URL(publicBaseUrl ?? request.url);
    if (!['http:', 'https:'].includes(expected.protocol)) return false;
    return origin === expected.origin;
  } catch {
    return false;
  }
}

/** Read only from the trusted internal API, never from forwarding headers. */
export async function hasTrustedRuntimeOrigin(request:{headers:Headers;url:string}):Promise<boolean>{
 const origin=request.headers.get('origin');if(!origin)return false;
 try{
  const {backendBaseUrl}=await import('./backend');
  const response=await fetch(`${backendBaseUrl}/v1/config`,{cache:'no-store',signal:AbortSignal.timeout(4000)});
  if(!response.ok)return false;
  const config=await response.json();
  return Array.isArray(config.allowedOrigins)&&config.allowedOrigins.includes(origin);
 }catch{return false;}
}
