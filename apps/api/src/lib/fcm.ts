import { createSign } from 'node:crypto';

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

type CachedAccessToken = {
  value: string;
  expiresAt: number;
};

let cachedServiceAccount: ServiceAccount | null | undefined;
let cachedAccessToken: CachedAccessToken | null = null;

function decodeServiceAccount(): ServiceAccount | null {
  if (cachedServiceAccount !== undefined) return cachedServiceAccount;

  const encoded = process.env.FIDA_FIREBASE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (!encoded) {
    cachedServiceAccount = null;
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as Partial<ServiceAccount>;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      cachedServiceAccount = null;
      return null;
    }
    cachedServiceAccount = parsed as ServiceAccount;
    return cachedServiceAccount;
  } catch {
    cachedServiceAccount = null;
    return null;
  }
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function accessToken(account: ServiceAccount) {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60_000) return cachedAccessToken.value;

  const issuedAt = Math.floor(now / 1000);
  const unsigned = `${base64UrlJson({ alg: 'RS256', typ: 'JWT' })}.${base64UrlJson({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: issuedAt,
    exp: issuedAt + 3600,
  })}`;

  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(account.private_key).toString('base64url')}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) throw new Error(`FCM OAuth failed (${response.status})`);
  const payload = await response.json() as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new Error('FCM OAuth response did not include an access token');

  cachedAccessToken = {
    value: payload.access_token,
    expiresAt: now + Math.max(60, payload.expires_in ?? 3600) * 1000,
  };
  return payload.access_token;
}

export function fcmConfigured() {
  return decodeServiceAccount() !== null;
}

export type FcmMessage = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

export async function sendFcmMessage(message: FcmMessage) {
  const account = decodeServiceAccount();
  if (!account) return { sent: false as const, skipped: true as const, reason: 'provider_not_configured' };

  const token = await accessToken(account);
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: message.token,
        notification: { title: message.title, body: message.body },
        data: message.data ?? {},
        android: {
          priority: 'high',
          notification: { sound: 'default' },
        },
      },
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    let providerCode: string | undefined;
    try {
      const parsed = JSON.parse(text) as { error?: { details?: Array<{ errorCode?: string }>; status?: string } };
      providerCode = parsed.error?.details?.find((entry) => entry.errorCode)?.errorCode ?? parsed.error?.status;
    } catch {}
    const error = new Error(`FCM send failed (${response.status})${providerCode ? `: ${providerCode}` : ''}`);
    return {
      sent: false as const,
      skipped: false as const,
      invalidToken: providerCode === 'UNREGISTERED' || providerCode === 'INVALID_ARGUMENT',
      error,
    };
  }

  let providerMessageId: string | undefined;
  try {
    providerMessageId = (JSON.parse(text) as { name?: string }).name;
  } catch {}
  return { sent: true as const, skipped: false as const, providerMessageId };
}
