// server/server.js
const express = require('express');
const path = require('path');
require('dotenv').config();

const { initShopify } = require('./shopify-config');
const customersRoute = require('./routes/customers');
const theme = require('./routes/theme');
const webhooks = require('./routes/webhooks');
const authRouter = require('./auth');

const app = express();
app.use(express.json());

// Ensure Shopify is ready and inject it on the request
function ensureShopifyReady(req, res, next) {
  const shopify = req.app.locals.shopify;
  if (!shopify) return res.status(503).json({ error: 'Shopify not initialized yet' });
  req.shopify = shopify;
  next();
}

// Routes (Shopify instance available as req.shopify)
app.use('/api', ensureShopifyReady, authRouter);               // /api/auth, /api/auth/callback
app.use('/api/customers', ensureShopifyReady, customersRoute);
app.use('/api/theme', ensureShopifyReady, theme.router);
app.use('/api/webhooks', ensureShopifyReady, webhooks.router);

// Serve React build
app.use(express.static(path.join(__dirname, '..', 'web', 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'dist', 'index.html'));
});

// Boot (initialize Shopify once, then start server)
(async () => {
  try {
    const shopify = await initShopify(); // does dynamic ESM imports
    app.locals.shopify = shopify;

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on :${PORT}`));
  } catch (e) {
    console.error('Failed to init Shopify:', e);
    process.exit(1);
  }
})();
