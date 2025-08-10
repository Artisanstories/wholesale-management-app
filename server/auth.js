// server/auth.js
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  const shopify = req.shopify;
  const shop = String(req.query.shop || '');
  if (!shop) return res.status(400).send('Missing shop');

  // Always begin OAuth at top-level
  await shopify.auth.begin({
    shop,
    callbackPath: '/api/auth/callback',
    isOnline: true,
    rawRequest: req,
    rawResponse: res,
  });
});

router.get('/inline', async (req, res) => {
  const shopify = req.shopify;
  const shop = String(req.query.shop || '');
  if (!shop) return res.status(400).send('Missing shop');

  await shopify.auth.begin({
    shop,
    callbackPath: '/api/auth/callback',
    isOnline: true,
    rawRequest: req,
    rawResponse: res,
  });
});

router.get('/callback', async (req, res) => {
  const shopify = req.shopify;
  const { session } = await shopify.auth.callback({
    rawRequest: req,
    rawResponse: res,
  });

  // Send back into the embedded app
  const host = String(req.query.host || '');
  const url = host
    ? `/?shop=${encodeURIComponent(session.shop)}&host=${encodeURIComponent(host)}`
    : `/?shop=${encodeURIComponent(session.shop)}`;
  res.redirect(302, url);
});

module.exports = router;
