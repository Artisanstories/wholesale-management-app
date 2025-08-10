// server/auth.js
const express = require('express');
const router = express.Router();

/**
 * Begin OAuth (embedded + online)
 * GET /api/auth?shop={shop}.myshopify.com
 */
router.get('/', async (req, res) => {
  try {
    const shopify = req.shopify;
    const shop = (req.query.shop || '').toString().trim();
    if (!shop) return res.status(400).send('Missing shop');

    const { redirectUrl } = await shopify.auth.begin({
      shop,
      isOnline: true,
      callbackPath: '/api/auth/callback',
      rawRequest: req,
      rawResponse: res,
    });

    // IMPORTANT: only one response; return after redirect
    return res.redirect(302, redirectUrl);
  } catch (e) {
    console.error('auth.begin error', e);
    return res.status(500).send('Auth begin failed');
  }
});

/**
 * Inline OAuth helper (same as above, but we keep a stable path apps can jump to)
 * GET /api/auth/inline?shop={shop}.myshopify.com
 */
router.get('/inline', async (req, res) => {
  try {
    const shopify = req.shopify;
    const shop = (req.query.shop || '').toString().trim();
    if (!shop) return res.status(400).send('Missing shop');

    const { redirectUrl } = await shopify.auth.begin({
      shop,
      isOnline: true,
      callbackPath: '/api/auth/callback',
      rawRequest: req,
      rawResponse: res,
    });

    return res.redirect(302, redirectUrl);
  } catch (e) {
    console.error('auth.inline error', e);
    return res.status(500).send('Auth inline failed');
  }
});

/**
 * OAuth callback
 * GET /api/auth/callback
 */
router.get('/callback', async (req, res) => {
  try {
    const shopify = req.shopify;
    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    // Redirect back into the app (embedded).
    // Keep host if Shopify provided it, so App Bridge boots cleanly.
    const host = (req.query.host || '').toString();
    const redirectTo = host
      ? `/?shop=${encodeURIComponent(session.shop)}&host=${encodeURIComponent(host)}`
      : `/?shop=${encodeURIComponent(session.shop)}`;

    return res.redirect(302, redirectTo);
  } catch (e) {
    console.error('auth.callback error', e);
    return res.status(500).send('Auth callback failed');
  }
});

module.exports = router;
