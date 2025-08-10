// web/src/lib/authFetch.ts
import createApp from '@shopify/app-bridge';
import { getSessionToken } from '@shopify/app-bridge-utils';

let app: ReturnType<typeof createApp> | null = null;

function getApp() {
  if (app) return app;
  const params = new URLSearchParams(window.location.search);
  const host = params.get('host') || '';
  const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY as string;
  if (!apiKey) throw new Error('VITE_SHOPIFY_API_KEY is missing');
  app = createApp({ apiKey, host });
  return app!;
}

function currentShopAndHost() {
  const u = new URL(window.location.href);
  const shop = u.searchParams.get('shop') || '';
  const host = u.searchParams.get('host') || '';
  return { shop, host };
}

let reauthInFlight = false;

async function doFetch(input: RequestInfo | URL, init: RequestInit) {
  const token = await getSessionToken(getApp());
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(input, { ...init, headers, credentials: 'include' });
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  opts: { retryOn5xx?: boolean } = { retryOn5xx: true }
) {
  const res = await doFetch(input, init);

  // 1) Force reauth if server asks for it
  if (res.status === 401 && res.headers.get('X-Shopify-API-Request-Failure-Reauthorize') === '1') {
    if (!reauthInFlight) {
      reauthInFlight = true;
      const { shop, host } = currentShopAndHost();
      const to = `/api/auth/inline?${new URLSearchParams({ shop, host }).toString()}`;
      window.location.href = to; // redirects inside the iframe (embedded-safe)
    }
    throw new Error('Reauthorizing…');
  }

  // 2) Retry once on transient upstream errors
  if (opts.retryOn5xx && (res.status === 502 || res.status === 503 || res.status === 504)) {
    await new Promise(r => setTimeout(r, 1200));
    return doFetch(input, init);
  }

  return res;
}
