// server/shopify-config.js
require("@shopify/shopify-api/adapters/node"); // runtime adapter MUST be first

const { shopifyApi, LATEST_API_VERSION } = require("@shopify/shopify-api");
const { MemorySessionStorage } = require("@shopify/shopify-api/session-storage/memory");

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: (process.env.SCOPES || "read_customers,read_products").split(","),
  hostName: (process.env.SHOPIFY_APP_URL || "")
    .replace(/^https?:\\/\\//, "")
    .replace(/\\/$/, ""),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
  sessionStorage: new MemorySessionStorage(),
});

module.exports = { shopify };
