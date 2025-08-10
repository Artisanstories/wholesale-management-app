// server/auth.js
const express = require('express');
const router = express.Router();

function shopFromHostParam(hostParam) {
  try {
    const decoded = Buffer.from(String(hostParam || ''), 'base64').toString('utf8');
    // e.g. "admin.shopify.com/store/<shop>/apps"
    const mStore = decoded.match(/\/store\/([^/?#]+)/i);
    if (mStore) return `${mStore[1]}.myshopify.com`;
    // or sometimes "<shop>.myshopify.com/admin"
    const mShop = decoded.match(/([a-z0-9-]+\.myshopify\.com)/i);
    if (mShop) return mShop[1];
  } catch {}
  return '';
}

function resolveShop(req) {
  const qShop = String(req.query.shop || '');
  if (qShop) return qShop;
  const hdrShop = String(req.headers['x-shopify-shop-domain'] || '');
  if (hdrShop) return hdrShop;
  const host = String(req.query.host || '');
  const fromHost = shopFromHostParam(host);
  if (fromHost) return fromHost;
  const ref = String(req.get('referer') || '');
  const m = ref.match(/shop=([a-z0-9-]+\.myshopify\.com)/i);
  return m ? m[1] : '';
}

// Kick off OAuth (works with or without ?host=)
router.get('/', async (req, res) => {
  const shopify = req.shopify;
  const shop = resolveShop(req);
  if (!shop) return res.status(400).send('Missing shop');

  const redirectUrl = await shopify.auth.begin({
    shop,
    callbackPath: '/api/auth/callback',
    isOnline: true,
    rawRequest: req,
    rawResponse: res,
  });

  return res.redirect(redirectUrl);
});

// Support /api/auth/inline used by App Bridge reauth
router.get('/inline', (req, res) => {
  const shop = resolveShop(req);
  if (!shop) return res.status(400).send('Missing shop');
  return res.redirect(`/api/auth?shop=${encodeURIComponent(shop)}`);
});

// OAuth callback
router.get('/callback', async (req, res) => {
  const shopify = req.shopify;
  try {
    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });
    const host = String(req.query.host || '');
    return res.redirect(
      `/?shop=${encodeURIComponent(session.shop)}${host ? `&host=${encodeURIComponent(host)}` : ''}`
    );
  } catch (e) {
    console.error('OAuth callback error:', e);
    return res.status(401).send('Auth failed');
  }
});

module.exports = router;
