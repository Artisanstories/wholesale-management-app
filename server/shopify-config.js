// server/shopify-config.js
require("@shopify/shopify-api/adapters/node"); // MUST be first

const { shopifyApi, LATEST_API_VERSION } = require("@shopify/shopify-api");
// IMPORTANT: use the .js subpath with newer @shopify/shopify-api
const { MemorySessionStorage } = require("@shopify/shopify-api/session-storage/memory.js");

const hostName = (process.env.SHOPIFY_APP_URL || process.env.HOST || "")
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");

const scopes =
  (process.env.SCOPES && process.env.SCOPES.split(",").map(s => s.trim())) ||
  ["read_customers", "read_products"];

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes,
  hostName,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
  sessionStorage: new MemorySessionStorage(), // OK for dev
});

module.exports = { shopify };
