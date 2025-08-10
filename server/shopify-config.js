// server/shopify-config.js (CommonJS, no subpath imports)
require('dotenv').config();

async function initShopify() {
  // adapter must be loaded once, via side-effect
  await import('@shopify/shopify-api/adapters/node');
  const { shopifyApi, LATEST_API_VERSION } = await import('@shopify/shopify-api');

  // Simple in-memory session storage (Render free tier friendly)
  const _sessions = new Map();
  const sessionStorage = {
    async storeSession(session) { _sessions.set(session.id, session); return true; },
    async loadSession(id) { return _sessions.get(id) || null; },
    async deleteSession(id) { return _sessions.delete(id); },
    async findSessionsByShop(shop) {
      return Array.from(_sessions.values()).filter(s => s.shop === shop);
    },
    async deleteSessions(shop) {
      for (const [id, s] of _sessions) if (s.shop === shop) _sessions.delete(id);
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
    hostName,                       // e.g. "wholesale-management-app.onrender.com"
    apiVersion: LATEST_API_VERSION, // you can also fix to '2024-07'
    isEmbeddedApp: true,
    sessionStorage,
  });

  console.log(`Shopify SDK ready (apiVersion=${shopify.config.apiVersion})`);
  return shopify;
}

module.exports = { initShopify };
