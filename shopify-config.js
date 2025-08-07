// shopify-config.js
import pkg from "@shopify/shopify-api";
const { shopifyApi, LATEST_API_VERSION } = pkg;

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SCOPES?.split(","),
  hostName: new URL(process.env.HOST).host,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false,
});

export default shopify;
