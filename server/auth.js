const express = require('express');
const router = express.Router();

function shopFromHost(hostB64 = '') {
  try {
    const decoded = Buffer.from(hostB64, 'base64').toString('utf8');
    const m = decoded.match(/([a-z0-9][a-z0-9-]+\.myshopify\.com)/i);
    return m ? m[1] : '';
  } catch { return ''; }
}

function setEmbedCsp(res, shop) {
  if (!shop) return;
  res.set('Content-Security-Policy', `frame-ancestors https://${shop} https://admin.shopify.com;`);
}

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
  } catch (e) {
    console.error('Auth begin error:', e);
    res.status(500).send('Auth begin failed');
  }
});

router.get('/inline', async (req, res) => {
  const shopify = req.shopify;
  const shop = (req.query.shop || shopFromHost(req.query.host || '') || '').toString();

  try {
    const sessionId = await shopify.session.getCurrentId({
      isOnline: true,
      rawRequest: req,
      rawResponse: res,
    });
    if (sessionId) {
      const host = (req.query.host || '').toString();
      const back = `/?shop=${encodeURIComponent(shop)}${host ? `&host=${encodeURIComponent(host)}` : ''}`;
      setEmbedCsp(res, shop);
      return res.redirect(302, back);
    }
  } catch { /* fall through */ }

  setEmbedCsp(res, shop);
  const topAuth = `/api/auth?shop=${encodeURIComponent(shop)}`;
  return res
    .status(200)
    .send(`<!doctype html><html><body><script>window.top.location.href=${JSON.stringify(topAuth)};</script></body></html>`);
});

router.get('/callback', async (req, res) => {
  try {
    const shopify = req.shopify;
    const { session } = await shopify.auth.callback({ rawRequest: req, rawResponse: res });
    const host = (req.query.host || '').toString();
    const back = `/?shop=${encodeURIComponent(session.shop)}${host ? `&host=${encodeURIComponent(host)}` : ''}`;
    return res.redirect(302, back);
  } catch (e) {
    console.error('Auth callback error:', e);
    res.status(500).send('Callback error');
  }
});

module.exports = router;
