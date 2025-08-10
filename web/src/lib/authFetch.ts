import createApp from '@shopify/app-bridge';
import { getSessionToken } from '@shopify/app-bridge-utils';

let app: ReturnType<typeof createApp> | null = null;

function getApp() {
  if (app) return app;
  const params = new URLSearchParams(window.location.search);
  const host = params.get('host') || '';
  const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY as string;
  app = createApp({ apiKey, host });
  return app!;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await getSessionToken(getApp()); // JWT from App Bridge
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(input, { ...init, headers, credentials: 'include' });

  // If the server says we must reauthorize, bounce to inline OAuth
  if (res.status === 401 && res.headers.get('X-Shopify-API-Request-Failure-Reauthorize') === '1') {
    const params = new URLSearchParams(window.location.search);
    const host = params.get('host') || '';
    const shop = params.get('shop') || '';
    const u = new URL('/api/auth/inline', window.location.origin);
    if (host) u.searchParams.set('host', host);
    if (shop) u.searchParams.set('shop', shop);
    window.location.assign(u.toString());
    // This request will never resolve because we navigate away
    throw new Error('Reauthorizing');
  }

  return res;
}
