// server/shopify-config.js
require('dotenv').config();
require('@shopify/shopify-api/adapters/node'); // adapter must be loaded first

const { shopifyApi, LATEST_API_VERSION } = require('@shopify/shopify-api');

// --- simple in-memory session storage (OK for dev/render free tier) ---
const _sessions = new Map();
const sessionStorage = {
  async storeSession(session) { _sessions.set(session.id, session); return true; },
  async loadSession(id) { return _sessions.get(id); },
  async deleteSession(id) { return _sessions.delete(id); },
  async findSessionsByShop(shop) {
    return [..._sessions.values()].filter((s) => s.shop === shop);
  },
  async deleteSessions(shop) {
    for (const [id, s] of _sessions) if (s.shop === shop) _sessions.delete(id);
    return true;
  },
};

// --- helpers ---
function assertEnv(name) {
  if (!process.env[name] || String(process.env[name]).trim() === '') {
    throw new Error(`Missing required env: ${name}`);
  }
}

function normalizeHost(host) {
  return String(host || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

// --- main factory ---
function initShopify() {
  // Validate critical env
  assertEnv('HOST');
  assertEnv('SHOPIFY_API_KEY');
  assertEnv('SHOPIFY_API_SECRET');
  assertEnv('SCOPES');

  const hostName = normalizeHost(process.env.HOST);
  const scopes = String(process.env.SCOPES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const apiVersion = process.env.SHOPIFY_API_VERSION || LATEST_API_VERSION;

  const shopify = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes,
    hostName,                 // e.g. wholesale-management-app.onrender.com
    apiVersion,               // e.g. 2024-07
    isEmbeddedApp: true,
    sessionStorage,
  });

  console.log(`[shopify] ready (apiVersion=${shopify.config.apiVersion}, host=${hostName})`);
  return shopify;
}

module.exports = { initShopify };
