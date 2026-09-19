import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasTrustedOrigin } from '../apps/admin-web/lib/request-origin.js';

const publicUrl = 'https://marketplaceadmin.fidalix.com';
function request(origin?: string, url = 'http://admin:3000/api/merchant/products/example') {
  return { url, headers: new Headers(origin === undefined ? {} : { origin }) };
}

test('accepts the configured HTTPS portal through an internal HTTP proxy', () => {
  assert.equal(hasTrustedOrigin(request(publicUrl), publicUrl), true);
  assert.equal(hasTrustedOrigin(request(publicUrl), `${publicUrl}/`), true);
});

test('rejects cross-origin, missing, malformed, wrong scheme and wrong port origins', () => {
  for (const origin of [undefined, 'null', 'broken', 'https://attacker.test',
    'http://marketplaceadmin.fidalix.com', `${publicUrl}:444`,
    `${publicUrl}.attacker.test`, `${publicUrl}/`, `${publicUrl}, https://attacker.test`]) {
    assert.equal(hasTrustedOrigin(request(origin), publicUrl), false, String(origin));
  }
  assert.equal(hasTrustedOrigin(request(publicUrl), 'not a URL'), false);
});

test('forwarded headers cannot authorize an untrusted origin', () => {
  const forged = request('https://attacker.test');
  forged.headers.set('x-forwarded-host', 'attacker.test');
  forged.headers.set('x-forwarded-proto', 'https');
  forged.headers.set('host', 'attacker.test');
  assert.equal(hasTrustedOrigin(forged, publicUrl), false);
});

test('direct deployments preserve same-origin validation without configuration', () => {
  // Passing no env configuration here is deliberate; restore the caller's value.
  const previous = process.env.PUBLIC_BASE_URL;
  delete process.env.PUBLIC_BASE_URL;
  try {
    assert.equal(hasTrustedOrigin(request('http://localhost:3000', 'http://localhost:3000/api/merchant/products')), true);
    assert.equal(hasTrustedOrigin(request(publicUrl)), false);
  } finally {
    if (previous === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previous;
  }
});
