// web/src/lib/authFetch.ts
import createApp from "@shopify/app-bridge";
import { getSessionToken } from "@shopify/app-bridge-utils";

let CACHED_HOST = "";
let CACHED_SHOP = "";
let _app: any | null = null;

function getHost() {
  if (CACHED_HOST) return CACHED_HOST;
  CACHED_HOST = new URLSearchParams(window.location.search).get("host") || "";
  return CACHED_HOST;
}

function decodeShopFromHost(host: string) {
  try {
    const decoded = atob(host);
    const m1 = decoded.match(/([a-z0-9-]+\.myshopify\.com)/i);
    if (m1) return m1[1];
    const m2 = decoded.match(/\/store\/([^/?#]+)/i);
    if (m2) return `${m2[1]}.myshopify.com`;
  } catch {}
  return "";
}

function getShopDomain() {
  if (CACHED_SHOP) return CACHED_SHOP;
  const fromQuery = new URLSearchParams(window.location.search).get("shop");
  if (fromQuery) return (CACHED_SHOP = fromQuery);
  const host = getHost();
  if (host) return (CACHED_SHOP = decodeShopFromHost(host));
  return "";
}

function getApp() {
  if (_app) return _app;
  const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY;
  const host = getHost();
  if (!apiKey || !host) {
    _app = null;
    return _app;
  }
  _app = createApp({ apiKey, host, forceRedirect: true });
  return _app;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const app = getApp();
  const headers = new Headers(init.headers || {});
  const shop = getShopDomain();

  if (app) {
    try {
      const token = await getSessionToken(app);
      headers.set("Authorization", `Bearer ${token}`);
    } catch {
      const reauthUrl = `/api/auth/inline${shop ? `?shop=${encodeURIComponent(shop)}` : ""}`;
      (window.top || window).location.href = reauthUrl;
      return new Promise<Response>(() => {});
    }
  }

  if (shop) headers.set("X-Shopify-Shop-Domain", shop);
  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(input, { ...init, headers, credentials: "same-origin" });

  if (
    res.status === 401 &&
    res.headers.get("X-Shopify-API-Request-Failure-Reauthorize") === "1"
  ) {
    const headerUrl = res.headers.get("X-Shopify-API-Request-Failure-Reauthorize-Url");
    const reauthUrl =
      headerUrl || `/api/auth/inline${shop ? `?shop=${encodeURIComponent(shop)}` : ""}`;
    (window.top || window).location.href = reauthUrl;
  }

  return res;
}
