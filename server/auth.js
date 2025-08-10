// server/auth.js
const express = require('express');
const router = express.Router();

function shopFromHostParam(hostParam) {
  try {
    const decoded = Buffer.from(String(hostParam || ''), 'base64').toString('utf8');
    const mStore = decoded.match(/\/store\/([^/?#]+)/i);
    if (mStore) return `${mStore[1]}.myshopify.com`;
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

// Kick off OAuth
router.get('/', async (req, res) => {
  try {
    const shopify = req.shopify;
    const shop = resolveShop(req);
    if (!shop) return res.status(400).send('Missing shop');

    const redirectUrl = await shopify.auth.begin({
      shop,
      callbackPath: '/api/auth/callback',
      isOnline: true,
      rawRequest: req,
      rawResponse: res, // sets cookies
    });

    // If nothing was sent yet, we do the redirect; otherwise, just end.
    if (!res.headersSent) return res.redirect(redirectUrl);
    return; // headers already sent by begin()
  } catch (e) {
    console.error('OAuth begin error:', e);
    if (!res.headersSent) return res.status(500).send('Auth begin failed');
  }
});

// App Bridge reauth helper
router.get('/inline', (req, res) => {
  const shop = resolveShop(req);
  if (!shop) return res.status(400).send('Missing shop');
  return res.redirect(`/api/auth?shop=${encodeURIComponent(shop)}`);
});

// OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const shopify = req.shopify;
    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res, // sets cookies
    });

    const host = String(req.query.host || '');
    const to = `/?shop=${encodeURIComponent(session.shop)}${
      host ? `&host=${encodeURIComponent(host)}` : ''
    }`;

    if (!res.headersSent) return res.redirect(to);
    return; // headers already sent by callback() edge-cases
  } catch (e) {
    console.error('OAuth callback error:', e);
    if (!res.headersSent) return res.status(401).send('Auth failed');
  }
});

module.exports = router;
