// shopify-config.js

// 👉 Side-effect import: registers the Node runtime adapter automatically
import "@shopify/shopify-api/adapters/node";

import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";

// Accept HOST with or without protocol (works with either value in Render)
function normalizeHost(host) {
  if (!host) throw new Error("HOST env var is missing");
  return host.replace(/^https?:\/\//, "");
}

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: (process.env.SCOPES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  hostName: normalizeHost(process.env.HOST),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false, // keep simple for now
});
