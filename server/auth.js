// server/auth.js
const express = require('express');
const router = express.Router();

// --- helpers ---
function shopFromHostB64(hostB64 = '') {
  try {
    const decoded = Buffer.from(hostB64, 'base64').toString('utf8'); // https://{shop}.myshopify.com/admin
    const m = decoded.match(/^https?:\/\/([^/]+)/i);
    return m ? m[1] : '';
  } catch {
    return '';
  }
}

async function shopFromAuthHeader(shopify, req) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice('Bearer '.length) : '';
    if (!token) return '';
    const payload = await shopify.utils.decodeSessionToken(token);
    // iss: https://{shop}.myshopify.com/admin
    // dest: https://{shop}.myshopify.com (or admin.shopify.com)
    const iss = payload?.iss || '';
    const dest = payload?.dest || '';
    const pick = iss || dest;
    return pick.replace(/^https?:\/\//, '').replace(/\/admin\/?$/, '');
  } catch {
    return '';
  }
}

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
      rawResponse: res,
    });
  } catch (e) {
    console.error('Auth begin error:', e);
    res.status(500).send('Auth begin failed');
  }
});

// Inline “pop-out”: GET /api/auth/inline?shop=... OR ?host=...
router.get('/auth/inline', (req, res) => {
  let shop = (req.query.shop || '').toString();
  const host = (req.query.host || '').toString();
  if (!shop && host) shop = shopFromHostB64(host);

  if (!shop) return res.status(400).send('Missing shop');

  const to = `/api/auth?shop=${encodeURIComponent(shop)}`;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url='${to}'"></head>
<body>Redirecting…
<script>(window.top||window).location.href=${JSON.stringify(to)};</script>
</body></html>`;
  res.set('Content-Type', 'text/html').status(200).send(html);
});

// New: ensure there’s a session, otherwise instruct the client to reauth top-level
// GET /api/ensure-auth
router.get('/ensure-auth', async (req, res) => {
  try {
    const shopify = req.shopify;
    const sessionId = await shopify.session.getCurrentId({
      isOnline: true,
      rawRequest: req,
      rawResponse: res,
    });
    const session = sessionId
      ? await shopify.config.sessionStorage.loadSession(sessionId)
      : null;

    if (!session) {
      const shop = (await shopFromAuthHeader(shopify, req)) || '';
      res
        .status(401)
        .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
        .set(
          'X-Shopify-API-Request-Failure-Reauthorize-Url',
          shop ? `/api/auth/inline?shop=${encodeURIComponent(shop)}` : `/api/auth/inline`
        )
        .json({ reauth: true });
      return;
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('ensure-auth error', e);
    res.status(500).json({ error: 'ensure-auth failed' });
  }
});

// OAuth callback: GET /api/auth/callback
router.get('/auth/callback', async (req, res) => {
  try {
    const shopify = req.shopify;
    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const host = (req.query.host || '').toString();
    return res.redirect(
      `/?shop=${encodeURIComponent(session.shop)}${host ? `&host=${encodeURIComponent(host)}` : ''}`
    );
  } catch (e) {
    console.error('Auth callback error:', e);
    res.status(500).send('Callback error');
  }
});

module.exports = router;
