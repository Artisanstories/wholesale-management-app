// server/auth.js
const express = require('express');
const router = express.Router();

/**
 * Start OAuth (top-level redirect handled by Shopify SDK).
 */
router.get('/', async (req, res) => {
  const shopify = req.shopify;
  const shop = (req.query.shop || '').toString();
  if (!shop) return res.status(400).send('Missing shop');

  await shopify.auth.begin({
    shop,
    callbackPath: '/api/auth/callback',
    isOnline: true,
    rawRequest: req,
    rawResponse: res,
  });
  // IMPORTANT: Express must not continue after begin() writes headers.
  return;
});

/**
 * Inline reauth entry (used by the frontend when it receives 401+reauth headers)
 */
router.get('/inline', async (req, res) => {
  const shopify = req.shopify;
  const shop = (req.query.shop || '').toString();
  if (!shop) return res.status(400).send('Missing shop');

  await shopify.auth.begin({
    shop,
    callbackPath: '/api/auth/callback',
    isOnline: true,
    rawRequest: req,
    rawResponse: res,
  });
  return;
});

/**
 * OAuth callback: creates the session then redirects back to the embedded app.
 */
router.get('/callback', async (req, res) => {
  const shopify = req.shopify;
  try {
    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    // (Optional) cleanup of any top-level cookies the SDK used
    try { await shopify.auth.deleteShopifyCookies(req, res); } catch {}

    const host = (req.query.host || '').toString();
    const shop = session.shop;
    const redirectTo = host
      ? `/?host=${encodeURIComponent(host)}&shop=${encodeURIComponent(shop)}`
      : `/?shop=${encodeURIComponent(shop)}`;

    return res.redirect(302, redirectTo);
  } catch (e) {
    console.error('OAuth callback error:', e);
    return res.status(401).send('Auth failed');
  }
});

module.exports = router;
