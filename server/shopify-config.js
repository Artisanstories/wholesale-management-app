// server/shopify-config.js
require('dotenv').config();

async function initShopify() {
  // ESM-only SDK: load via dynamic import
  await import('@shopify/shopify-api/adapters/node'); // side-effect adapter
  const { shopifyApi, LATEST_API_VERSION } = await import('@shopify/shopify-api');

  // Simple in-memory session storage (no subpath imports)
  const _sessions = new Map();
  const sessionStorage = {
    async storeSession(session) {
      _sessions.set(session.id, session);
      return true;
    },
    async loadSession(id) {
      return _sessions.get(id);
    },
    async deleteSession(id) {
      return _sessions.delete(id);
    },
    async findSessionsByShop(shop) {
      return Array.from(_sessions.values()).filter((s) => s.shop === shop);
    },
    async deleteSessions(shop) {
      for (const [id, s] of _sessions) {
        if (s.shop === shop) _sessions.delete(id);
      }
      return true;
    },
  };

  const hostName = (process.env.HOST || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  const shopify = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: (process.env.SCOPES || '').split(',').map(s => s.trim()).filter(Boolean),
    hostName,
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
    sessionStorage, // <-- custom storage
  });

  console.log(`Shopify SDK ready (apiVersion=${shopify.config.apiVersion})`);
  return shopify;
}

module.exports = { initShopify };
