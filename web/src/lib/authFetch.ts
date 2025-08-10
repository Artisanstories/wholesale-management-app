// web/src/lib/authFetch.ts
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  // always include cookies for embedded apps
  const res = await fetch(input, { credentials: 'include', ...init });

  // If Shopify wants us to reauthorize, do a top-level redirect (not inside the iframe)
  const mustReauth = res.status === 401 &&
    res.headers.get('X-Shopify-API-Request-Failure-Reauthorize') === '1';

  if (mustReauth && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);

    // server may give us a full URL — use it; otherwise fall back to /api/auth/inline
    const headerUrl = res.headers.get('X-Shopify-API-Request-Failure-Reauthorize-Url') || '/api/auth/inline';
    const url = new URL(headerUrl, window.location.origin);

    // make sure shop is present
    const shop = params.get('shop');
    if (shop && !url.searchParams.get('shop')) {
      url.searchParams.set('shop', shop);
    }

    // TOP-LEVEL redirect (fixes “accounts.shopify.com refused to connect”)
    try {
      if (window.top && window.top !== window.self) {
        window.top.location.href = url.toString();
      } else {
        window.location.href = url.toString();
      }
    } catch {
      // last-resort fallback
      window.location.href = url.toString();
    }

    // stop callers from using this response
    throw new Error('Reauthorizing…');
  }

  return res;
}
