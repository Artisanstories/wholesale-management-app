// server/auth.js
const express = require('express');
const router = express.Router();

router.get('/begin', async (req, res) => {
  try {
    const shopify = req.shopify;
    const shop = (req.query.shop || '').toString();

    if (!shop) return res.status(400).send('Missing shop');

    // SDK will set the 302 Location header for you when rawRequest/rawResponse are provided
    await shopify.auth.begin({
      shop,
      callbackPath: '/auth/callback',
      isOnline: true,
      rawRequest: req,
      rawResponse: res,
    });
    // Do not write to res here — begin() already handled it.
  } catch (e) {
    console.error('Auth begin error:', e);
    res.status(500).send('Auth begin failed');
  }
});

router.get('/callback', async (req, res) => {
  try {
    const shopify = req.shopify;
    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    // You should persist the session here.

    // For embedded apps, redirect back to Admin with host param if present
    const host = req.query.host || '';
    return res.redirect(`/?shop=${encodeURIComponent(session.shop)}${host ? `&host=${encodeURIComponent(host)}` : ''}`);
  } catch (e) {
    console.error('Auth callback error:', e);
    res.status(500).send('Callback error');
  }
});

module.exports = router;
