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
  const token = await getSessionToken(getApp()); // JWT
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(input, { ...init, headers, credentials: 'include' });
}
