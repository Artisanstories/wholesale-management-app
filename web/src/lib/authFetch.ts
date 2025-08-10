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
    forceRedirect: true, // sends us to top-level if Shopify needs to re-auth
  });
  return app;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = await getSessionToken(getApp());

  const res = await fetch(input, {
    ...init,
    credentials: 'omit', // don't rely on cookies
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  // If Shopify asks us to reauthorize, bounce to /api/auth at top-level
  if (res.status === 401 && res.headers.get('X-Shopify-API-Request-Failure-Reauthorize') === '1') {
    const url = res.headers.get('X-Shopify-API-Request-Failure-Reauthorize-Url') || '/api/auth';
    window.top!.location.href = url;
    throw new Error('Reauthorizing…');
  }

  return res;
}
