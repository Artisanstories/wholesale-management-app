// web/src/lib/authFetch.ts
import createApp from '@shopify/app-bridge';
import { getSessionToken } from '@shopify/app-bridge-utils';

function getSearchParam(name: string) {
  return new URLSearchParams(window.location.search).get(name) || '';
}

const app = createApp({
  apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
  host: getSearchParam('host'),
  forceRedirect: true,
});

export async function authFetch(input: RequestInfo, init: RequestInit = {}) {
  const token = await getSessionToken(app);

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers });

  if (
    res.status === 401 &&
    res.headers.get('X-Shopify-API-Request-Failure-Reauthorize') === '1'
  ) {
    const shop = getSearchParam('shop');
    const host = getSearchParam('host');
    const url = `/api/auth/inline${shop ? `?shop=${encodeURIComponent(shop)}` : ''}${
      host ? `${shop ? '&' : '?'}host=${encodeURIComponent(host)}` : ''
    }`;
    // top-level redirect so cookies/session are set correctly
    window.top!.location.href = url;
  }

  return res;
}
