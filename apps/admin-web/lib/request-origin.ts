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
