// web/src/lib/authFetch.ts
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

function base64UrlDecode(s: string) {
  // Convert base64url -> base64 then decode
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  return atob(s);
}

function decodeJwtPayload(token: string): any | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    return JSON.parse(base64UrlDecode(payload));
  } catch {
    return null;
  }
}

function hostnameFromUrl(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return '';
  }
}

function deriveShopFromToken(token: string): string {
  const p = decodeJwtPayload(token);
  if (!p) return '';
  // Prefer iss (usually https://{shop}.myshopify.com/admin)
  const issHost = p.iss ? hostnameFromUrl(p.iss) : '';
  if (issHost && issHost.endsWith('.myshopify.com')) return issHost;

  // Fallback to dest (sometimes admin.shopify.com, sometimes myshopify)
  const destHost = p.dest ? hostnameFromUrl(p.dest) : '';
  if (destHost.endsWith('.myshopify.com')) return destHost;

  return '';
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

    // Ensure shop & host are present
    const shopFromToken = deriveShopFromToken(token);
    if (shopFromToken && !params.get('shop')) params.set('shop', shopFromToken);

    const host = getHost();
    if (host && !params.get('host')) params.set('host', host);

    url.search = params.toString();

    // Top-level redirect so the OAuth state cookie can be set
    (window.top ?? window).location.href = url.toString();
    throw new Error('Reauthorizing…');
  }

  return res;
}
