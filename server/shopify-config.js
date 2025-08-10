// server/shopify-config.js
require('dotenv').config();

async function initShopify() {
  await import('@shopify/shopify-api/adapters/node'); // side-effect adapter
  const { shopifyApi, LATEST_API_VERSION } = await import('@shopify/shopify-api');
  const { MemorySessionStorage } = await import('@shopify/shopify-api/session-storage/memory');

  const hostName = (process.env.HOST || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  return shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: (process.env.SCOPES || '').split(',').map(s => s.trim()).filter(Boolean),
    hostName,
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
    sessionStorage: new MemorySessionStorage()
  });
}

module.exports = { initShopify };
