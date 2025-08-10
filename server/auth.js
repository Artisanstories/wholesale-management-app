// server/auth.js
const express = require('express');
const router = express.Router();

// 1) Inline endpoint: break out of the iframe, then hit /api/auth
router.get('/inline', (req, res) => {
  const shop = req.query.shop;
  const host = req.query.host || '';
  if (!shop) return res.status(400).send('Missing shop');

  const to = `/api/auth?shop=${encodeURIComponent(shop)}${host ? `&host=${encodeURIComponent(host)}` : ''}`;

  res.set('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html><html><body>
<script>
  // Always redirect the TOP window so cookies are first-party.
  (window.top || window).location.href = ${JSON.stringify(to)};
</script>
</body></html>`);
});

// 2) Begin OAuth at top level
router.get('/', async (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) return res.status(400).send('Missing shop');
    await req.shopify.auth.begin({
      shop,
      callbackPath: '/api/auth/callback',
      isOnline: true,
      rawRequest: req,
      rawResponse: res,
    });
    // NOTE: shopify.auth.begin will 302 for you.
  } catch (e) {
    console.error('auth begin error', e);
    res.status(500).send('Auth error');
  }
});

// 3) Complete OAuth and send the user back into the embedded app
router.get('/callback', async (req, res) => {
  try {
    const { session } = await req.shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const host = req.query.host || '';
    const backToApp = `/?shop=${encodeURIComponent(session.shop)}${host ? `&host=${encodeURIComponent(host)}` : ''}`;

    // Return HTML that always redirects the TOP window back to the app
    res.set('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html><html><body>
<script>
  (window.top || window).location.href = ${JSON.stringify(backToApp)};
</script>
</body></html>`);
  } catch (e) {
    console.error('auth callback error', e);
    res.status(401).send('OAuth error');
  }
});

module.exports = router;
