// web/src/lib/authFetch.ts
import createApp from '@shopify/app-bridge';
import { getSessionToken } from '@shopify/app-bridge-utils';

let app: any;
function getApp() {
  if (app) return app;
  const host = new URLSearchParams(window.location.search).get('host')!;
  app = createApp({
    apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
    host,
    forceRedirect: true,
  });
  return app;
}

export async function authFetch(input: RequestInfo, init: RequestInit = {}) {
  const a = getApp();
  const token = await getSessionToken(a);

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(input, { ...init, headers, credentials: 'include' });

  // If the server says reauthorize, do inline auth (top-level redirect)
  if (res.status === 401 && res.headers.get('X-Shopify-API-Request-Failure-Reauthorize') === '1') {
    const qp = new URLSearchParams(window.location.search);
    const shop = qp.get('shop')!;
    const host = qp.get('host')!;
    (window.top || window).location.href =
      `/api/auth/inline?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`;
    throw new Error('Reauth');
  }

  return res;
}
