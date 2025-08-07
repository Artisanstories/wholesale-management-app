// shopify-config.js

import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SCOPES.split(","),
  hostName: new URL(process.env.HOST).host,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false,
});
