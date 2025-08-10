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

function shopFromHost(host: string): string {
  try {
    const decoded = atob(host); // https://{shop}.myshopify.com/admin
    const m = decoded.match(/^https?:\/\/([^/]+)/i);
    return m ? m[1] : '';
  } catch {
    return '';
  }
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
    // Build a robust reauth URL
    const headerPath =
      res.headers.get('X-Shopify-API-Request-Failure-Reauthorize-Url') || '/api/auth/inline';

    const url = new URL(headerPath, window.location.origin);
    const params = new URLSearchParams(url.search);

    // If shop missing, derive from host and add
    if (!params.get('shop')) {
      const host = getHost();
      const shop = shopFromHost(host);
      if (shop) params.set('shop', shop);
      if (host && !params.get('host')) params.set('host', host);
      url.search = params.toString();
    }

    // Top-level redirect so OAuth state cookie can be set
    (window.top ?? window).location.href = url.toString();
    throw new Error('Reauthorizing…');
  }

  return res;
}
