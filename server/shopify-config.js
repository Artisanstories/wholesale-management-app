// server/shopify-config.js
require('dotenv').config();

async function initShopify() {
  // Load ESM modules via dynamic import
  const { shopifyApi, LATEST_API_VERSION } = await import('@shopify/shopify-api');
  const { MemorySessionStorage } = await import('@shopify/shopify-api/session-storage/memory');

  const host = process.env.HOST || '';
  const hostName = host.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const shopify = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: (process.env.SCOPES || '').split(',').map(s => s.trim()).filter(Boolean),
    hostName,
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
    sessionStorage: new MemorySessionStorage(), // ✅ correct subpath
  });

  return shopify;
}

module.exports = { initShopify };
