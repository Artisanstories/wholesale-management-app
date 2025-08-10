import { getToken } from './appBridge';

export async function authFetch(input: RequestInfo, init: RequestInit = {}) {
  const token = await getToken().catch(() => null);

  const headers = new Headers(init.headers as HeadersInit);
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers, credentials: 'include' });

  // If server says "reauthorize", do the top-level redirect
  if (res.status === 401 && res.headers.get('X-Shopify-API-Request-Failure-Reauthorize') === '1') {
    const params = new URLSearchParams(window.location.search);
    const shop = params.get('shop') || '';
    const host = params.get('host') || '';
    const url = res.headers.get('X-Shopify-API-Request-Failure-Reauthorize-Url')
      || `/api/auth/inline?shop=${encodeURIComponent(shop)}`;
    const sep = url.includes('?') ? '&' : '?';
    (window.top || window).location.href = `${url}${sep}host=${encodeURIComponent(host)}`;
  }

  return res;
}
