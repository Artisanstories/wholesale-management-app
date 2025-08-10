// web/src/lib/authFetch.ts
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
  const token = await getSessionToken(getApp());
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(input, { ...init, headers, credentials: 'include' });

  if (res.status === 401) {
    // Inline OAuth bounce
    const reauth = res.headers.get('X-Shopify-API-Request-Failure-Reauthorize');
    const reauthUrl = res.headers.get('X-Shopify-API-Request-Failure-Reauthorize-Url');
    if (reauth === '1') {
      const params = new URLSearchParams(window.location.search);
      const host = params.get('host') || '';
      const shop = params.get('shop') || '';
      const url = reauthUrl || `/api/auth/inline?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`;
      // take top window out of iframe
      window.top!.location.href = url;
      // throw to stop caller logic
      throw new Error('Reauth');
    }
  }

  return res;
}
