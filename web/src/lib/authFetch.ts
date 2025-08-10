import createApp from '@shopify/app-bridge';
import { getSessionToken } from '@shopify/app-bridge-utils';

let app: ReturnType<typeof createApp> | null = null;

function getHost(): string {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('host') || '';
  const saved = localStorage.getItem('shopify-host') || '';
  const host = fromUrl || saved;
  if (fromUrl && fromUrl !== saved) localStorage.setItem('shopify-host', fromUrl);
  return host;
}

function getApp() {
  if (app) return app;
  const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY as string | undefined;
  if (!apiKey) throw new Error('VITE_SHOPIFY_API_KEY missing. Set it in Render env and redeploy.');
  app = createApp({ apiKey, host: getHost() });
  return app!;
}

async function getTokenWithRetry(retries = 1): Promise<string> {
  const app = getApp();
  try {
    return await getSessionToken(app);
  } catch (e) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 200));
      return getTokenWithRetry(retries - 1);
    }
    throw e;
  }
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await getTokenWithRetry(1);
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(input, { ...init, headers, credentials: 'include' });

  if (res.status === 401) {
    // Read reauth path from headers (server sends it), default to /api/auth
    const reauthPath =
      res.headers.get('X-Shopify-API-Request-Failure-Reauthorize-Url') || '/api/auth';

    // Compute absolute URL on *our app domain* and pop to the top frame.
    const absolute = new URL(reauthPath, window.location.origin).toString();
    // Top-level redirect is REQUIRED so the OAuth state cookie can be set.
    (window.top ?? window).location.href = absolute;

    throw new Error('Reauthorizing…');
  }

  return res;
}
