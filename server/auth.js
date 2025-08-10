const express = require('express');
const router = express.Router();

/** Decode host (base64 of "<shop>.myshopify.com/admin") → "<shop>.myshopify.com" */
function shopFromHost(hostB64 = '') {
  try {
    const decoded = Buffer.from(hostB64, 'base64').toString('utf8');
    const m = decoded.match(/([a-z0-9][a-z0-9-]+\.myshopify\.com)/i);
    return m ? m[1] : '';
  } catch {
    return '';
  }
}

/** Common CSP header for embedded pages */
function setEmbedCsp(res, shop) {
  if (!shop) return;
  res.set(
    'Content-Security-Policy',
    `frame-ancestors https://${shop} https://admin.shopify.com;`
  );
}

/** GET /api/auth (top-level) – starts OAuth */
router.get('/', async (req, res) => {
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
    // begin() writes the 302 response – do not write to res after this
  } catch (e) {
    console.error('Auth begin error:', e);
    res.status(500).send('Auth begin failed');
  }
});

/** GET /api/auth/inline – called inside the iframe to bounce to top-level /api/auth */
router.get('/inline', async (req, res) => {
  const shopify = req.shopify;

  // Try get shop from query or decode from host
  const shop = (req.query.shop || shopFromHost(req.query.host || '') || '').toString();

  // If we already have a session, go straight back to the app
  try {
    const sessionId = await shopify.session.getCurrentId({
      isOnline: true,
      rawRequest: req,
      rawResponse: res,
    });
    if (sessionId) {
      const host = (req.query.host || '').toString();
      const redirectBack = `/?shop=${encodeURIComponent(
        shop || ''
      )}${host ? `&host=${encodeURIComponent(host)}` : ''}`;
      setEmbedCsp(res, shop);
      return res.redirect(302, redirectBack);
    }
  } catch {
    // fall through to redirect script
  }

  // We are in the iframe, kick the browser to the top-level /api/auth
  setEmbedCsp(res, shop);
  const topAuthUrl = `/api/auth?shop=${encodeURIComponent(shop)}`;
  return res
    .status(200)
    .send(
      `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
        <script>window.top.location.href = ${JSON.stringify(topAuthUrl)};</script>
      </body></html>`
    );
});

/** GET /api/auth/callback – completes OAuth and redirects back to the app */
router.get('/callback', async (req, res) => {
  try {
    const shopify = req.shopify;
    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    // Persisted by our sessionStorage; nothing else to do here.

    const host = (req.query.host || '').toString();
    const back = `/?shop=${encodeURIComponent(
      session.shop
    )}${host ? `&host=${encodeURIComponent(host)}` : ''}`;
    return res.redirect(302, back);
  } catch (e) {
    console.error('Auth callback error:', e);
    res.status(500).send('Callback error');
  }
});

module.exports = router;
