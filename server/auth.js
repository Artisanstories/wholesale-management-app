// server/auth.js
const express = require('express');
const router = express.Router();

/** Helper: decode shop from the JWT when we have a bearer */
async function shopFromAuthHeader(shopify, req) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : '';
    if (!token) return null;
    const payload = await shopify.utils.decodeSessionToken(token);
    const dest = String(payload.dest || ''); // https://{shop}.myshopify.com
    return dest.replace(/^https?:\/\//, '');
  } catch {
    return null;
  }
}

/** Kick off OAuth (must run at TOP-LEVEL, not inside iframe) */
router.get('/auth', async (req, res) => {
  try {
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
    // NOTE: begin() ends the response with a redirect
  } catch (e) {
    console.error('Auth begin error:', e);
    res.status(500).send('Auth begin failed');
  }
});

/** Inline page (runs inside iframe) to bounce the browser to top-level /api/auth */
router.get('/auth/inline', (req, res) => {
  const shop = String(req.query.shop || '');
  const host = String(req.query.host || '');
  if (!shop) return res.status(400).send('Missing shop');
  // Minimal HTML that uses App Bridge Redirect to top window
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>Auth</title></head>
  <body>
    <script src="https://unpkg.com/@shopify/app-bridge@3"></script>
    <script>
      (function() {
        var shop = ${JSON.stringify(shop)};
        var host = ${JSON.stringify(host)};
        var app = window['app-bridge'].default.create({
          apiKey: ${JSON.stringify(process.env.SHOPIFY_API_KEY)},
          host: host
        });
        var Redirect = window['app-bridge'].actions.Redirect;
        Redirect.create(app).dispatch(Redirect.Action.REMOTE, '/api/auth?shop=' + encodeURIComponent(shop));
      })();
    </script>
  </body>
</html>`);
});

/** OAuth callback */
router.get('/auth/callback', async (req, res) => {
  try {
    const shopify = req.shopify;
    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    // Optional: register webhooks here with shopify.webhooks...
    const host = String(req.query.host || '');
    return res.redirect(`/?shop=${encodeURIComponent(session.shop)}${host ? `&host=${encodeURIComponent(host)}` : ''}`);
  } catch (e) {
    console.error('Auth callback error:', e);
    res.status(500).send('Callback error');
  }
});

/** Ping this first from the client; if we have no session, respond with headers to reauth */
router.get('/ensure-auth', async (req, res) => {
  const shopify = req.shopify;
  const sessionId = await shopify.session.getCurrentId({
    isOnline: true,
    rawRequest: req,
    rawResponse: res,
  });

  if (sessionId && await shopify.config.sessionStorage.loadSession(sessionId)) {
    return res.json({ ok: true });
  }

  // No session: tell client to start OAuth
  const shop = (await shopFromAuthHeader(shopify, req)) || String(req.query.shop || '');
  if (!shop) return res.status(401).json({ error: 'missing_shop' });

  res
    .status(401)
    .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
    .set('X-Shopify-API-Request-Failure-Reauthorize-Url', `/api/auth/inline?shop=${encodeURIComponent(shop)}${req.query.host ? `&host=${encodeURIComponent(String(req.query.host))}` : ''}`)
    .json({ error: 'reauthorize' });
});

module.exports = router;
