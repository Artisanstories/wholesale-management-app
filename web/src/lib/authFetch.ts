// web/src/lib/authFetch.ts
import createApp from "@shopify/app-bridge";
import { getSessionToken } from "@shopify/app-bridge-utils";

function getHost() {
  return new URLSearchParams(window.location.search).get("host") || "";
}
function decodeShopFromHost(host: string) {
  try {
    const s = atob(host);
    const m1 = s.match(/([a-z0-9-]+\.myshopify\.com)/i);
    if (m1) return m1[1];
    const m2 = s.match(/\/store\/([^/?#]+)/i);
    if (m2) return `${m2[1]}.myshopify.com`;
  } catch {}
  return "";
}
function getShopDomain() {
  const fromQuery = new URLSearchParams(window.location.search).get("shop");
  if (fromQuery) return fromQuery;
  const host = getHost();
  if (host) return decodeShopFromHost(host);
  return "";
}

let _app: any;
function app() {
  if (_app) return _app;
  _app = createApp({
    apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
    host: getHost(),
    forceRedirect: true,
  });
  return _app;
}

export async function authFetch(input: RequestInfo, init: RequestInit = {}) {
  const token = await getSessionToken(app());

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  const shop = getShopDomain();
  if (shop) headers.set("X-Shopify-Shop-Domain", shop);

  const res = await fetch(input, { ...init, headers, credentials: "same-origin" });

  if (res.status === 401 && res.headers.get("X-Shopify-API-Request-Failure-Reauthorize") === "1") {
    const fromHeader = res.headers.get("X-Shopify-API-Request-Failure-Reauthorize-Url");
    const url = fromHeader || `/api/auth/inline${shop ? `?shop=${encodeURIComponent(shop)}` : ""}`;
    (window.top || window).location.href = url;
  }

  return res;
}
