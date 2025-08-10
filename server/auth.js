// server/auth.js
const express = require('express');
const router = express.Router();

// Start OAuth: GET /api/auth?shop={shop}.myshopify.com
router.get('/auth', async (req, res) => {
  try {
    const shopify = req.shopify;
    const shop = (req.query.shop || '').toString();
    if (!shop) return res.status(400).send('Missing shop');

    await shopify.auth.begin({
      shop,
      callbackPath: '/api/auth/callback', // must match mount + Partner redirect URL
      isOnline: true,
      rawRequest: req,
      rawResponse: res
    });
  } catch (e) {
    console.error('Auth begin error:', e);
    res.status(500).send('Auth begin failed');
  }
});

// OAuth callback: GET /api/auth/callback
router.get('/auth/callback', async (req, res) => {
  try {
    const shopify = req.shopify;
    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res
    });

    // TODO: persist session (DB/Redis) if you need it beyond memory

    const host = (req.query.host || '').toString();
    return res.redirect(`/?shop=${encodeURIComponent(session.shop)}${host ? `&host=${encodeURIComponent(host)}` : ''}`);
  } catch (e) {
    console.error('Auth callback error:', e);
    res.status(500).send('Callback error');
  }
});

module.exports = router;
