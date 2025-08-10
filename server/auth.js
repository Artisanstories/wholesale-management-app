// server/auth.js
const express = require('express');
const router = express.Router();

/** Try to extract shop domain from Shopify "host" param (base64) */
function shopFromHostParam(hostParam) {
  try {
    const decoded = Buffer.from(String(hostParam || ''), 'base64').toString('utf8');
    // hostParam often looks like "storename.myshopify.com/admin"
    const parts = decoded.replace(/^https?:\/\//, '').split('/');
    const host = parts[0];
    return host && host.endsWith('.myshopify.com') ? host : '';
  } catch {
    return '';
  }
}

/** Best-effort ways to get the shop domain for OAuth */
function getShopFromReq(req) {
  const qShop = String(req.query.shop || '');
  if (qShop.endsWith('.myshopify.com')) return qShop;

  const fromHeader = String(req.headers['x-shopify-shop-domain'] || '');
  if (fromHeader.endsWith('.myshopify.com')) return fromHeader;

  const fromHost = shopFromHostParam(req.query.host);
  if (fromHost) return fromHost;

  try {
    const ref = req.get('referer') || '';
    const u = new URL(ref);
    const h = u.searchParams.get('host');
    const fromRef = shopFromHostParam(h);
    if (fromRef) return fromRef;
  } catch {}

  return '';
}

// Start OAuth (top-level redirect)
router.get('/', async (req, res) => {
  const shop = getShopFromReq(req);
  if (!shop) return res.status(400).send('Missing shop');

  await req.shopify.auth.begin({
    shop,
    isOnline: true,
    callbackPath: '/api/auth/callback',
    rawRequest: req,
    rawResponse: res,
  });
});

// Start OAuth in-frame (App Bridge calls this)
router.get('/inline', async (req, res) => {
  const shop = getShopFromReq(req);
  if (!shop) return res.status(400).send('Missing shop');

  await req.shopify.auth.begin({
    shop,
    isOnline: true,
    callbackPath: '/api/auth/callback',
    rawRequest: req,
    rawResponse: res,
  });
});

// Complete OAuth
router.get('/callback', async (req, res) => {
  try {
    const { session } = await req.shopify.auth.callback({
      isOnline: true,
      rawRequest: req,
      rawResponse: res,
    });

    // Send the merchant back into the embedded app with host preserved
    const host = String(req.query.host || '');
    const redirectUrl = host
      ? `/?shop=${encodeURIComponent(session.shop)}&host=${encodeURIComponent(host)}`
      : `/?shop=${encodeURIComponent(session.shop)}`;

    return res.redirect(302, redirectUrl);
  } catch (e) {
    console.error('OAuth callback error:', e);
    const shop = getShopFromReq(req);
    return res
      .status(401)
      .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
      .set(
        'X-Shopify-API-Request-Failure-Reauthorize-Url',
        `/api/auth${shop ? `?shop=${encodeURIComponent(shop)}` : ''}`,
      )
      .send('Auth failed. Please reopen the app.');
  }
});

module.exports = router;
