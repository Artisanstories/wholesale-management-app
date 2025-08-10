import createApp from '@shopify/app-bridge';
import { getSessionToken } from '@shopify/app-bridge-utils';

let app: any;

export function getAppBridge() {
  if (app) return app;
  const params = new URLSearchParams(window.location.search);
  const host = params.get('host') || '';
  const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY!;
  app = createApp({ apiKey, host, forceRedirect: true });
  return app;
}

export async function getToken() {
  const ab = getAppBridge();
  return await getSessionToken(ab);
}
