// server/shopify-config.js
require('dotenv').config();

let cachedShopify = null;

async function initShopify() {
  if (cachedShopify) return cachedShopify;

  // Adapter must be loaded first (side-effect).
  await import('@shopify/shopify-api/adapters/node');
  const { shopifyApi } = await import('@shopify/shopify-api');

  // Simple in-memory sessions (ok on Render; will reset on deploy/restart).
  const _sessions = new Map();
  const sessionStorage = {
    async storeSession(session) { _sessions.set(session.id, session); return true; },
    async loadSession(id) { return _sessions.get(id); },
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

  const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-07'; // ✅ pin to supported version

  const shopify = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: (process.env.SCOPES || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    hostName,
    apiVersion,
    isEmbeddedApp: true,
    sessionStorage,
  });

  console.log(`Shopify SDK ready (apiVersion=${shopify.config.apiVersion})`);
  cachedShopify = shopify;
  return shopify;
}

module.exports = { initShopify };
