// web/src/lib/authFetch.ts
import createApp from '@shopify/app-bridge';
import { getSessionToken } from '@shopify/app-bridge-utils';

let app: ReturnType<typeof createApp> | null = null;

function getApp() {
  if (app) return app;
  const host = new URLSearchParams(window.location.search).get('host') || '';
  app = createApp({
    apiKey: import.meta.env.VITE_SHOPIFY_API_KEY as string,
    host,
    forceRedirect: true,
  });
  return app;
}

export async function authFetch(input: RequestInfo, init: RequestInit = {}) {
  const ab = getApp();
  const token = await getSessionToken(ab);

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  // keep existing content-type if caller set it, otherwise default JSON
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const resp = await fetch(input, { ...init, headers, credentials: 'include' });

  if (
    resp.status === 401 &&
    resp.headers.get('X-Shopify-API-Request-Failure-Reauthorize') === '1'
  ) {
    const shop = new URLSearchParams(window.location.search).get('shop') || '';
    const url =
      resp.headers.get('X-Shopify-API-Request-Failure-Reauthorize-Url') ||
      `/api/auth/inline?shop=${encodeURIComponent(shop)}`;

    // important: top-level redirect to set cookies properly
    window.top!.location.href = url;
    throw new Error('Reauthorize');
  }

  return resp;
}
