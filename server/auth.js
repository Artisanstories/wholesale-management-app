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
      callbackPath: '/api/auth/callback',
      isOnline: true,
      rawRequest: req,
      rawResponse: res
    });
  } catch (e) {
    console.error('Auth begin error:', e);
    res.status(500).send('Auth begin failed');
  }
});

// ✅ New: Inline route that pops the browser to top-level /api/auth
// GET /api/auth/inline?shop={shop}.myshopify.com
router.get('/auth/inline', (req, res) => {
  const shop = (req.query.shop || '').toString();
  const to = `/api/auth?shop=${encodeURIComponent(shop)}`;
  const html = `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url='${to}'">
</head><body>
Redirecting…
<script> (window.top || window).location.href = ${JSON.stringify(to)}; </script>
</body></html>`;
  res.set('Content-Type', 'text/html').status(200).send(html);
});

// OAuth callback: GET /api/auth/callback
router.get('/auth/callback', async (req, res) => {
  try {
    const shopify = req.shopify;
    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res
    });

    const host = (req.query.host || '').toString();
    return res.redirect(`/?shop=${encodeURIComponent(session.shop)}${host ? `&host=${encodeURIComponent(host)}` : ''}`);
  } catch (e) {
    console.error('Auth callback error:', e);
    res.status(500).send('Callback error');
  }
});

module.exports = router;
