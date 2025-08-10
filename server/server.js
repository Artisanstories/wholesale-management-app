// server/server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const { initShopify } = require('./shopify-config');
const customersRoute = require('./routes/customers');
const theme = require('./routes/theme');        // keep if you use it
const webhooks = require('./routes/webhooks');  // keep if you use it
const authRouter = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

function ensureShopifyReady(req, res, next) {
  const shopify = req.app.locals.shopify;
  if (!shopify) return res.status(503).json({ error: 'Shopify not initialized yet' });
  req.shopify = shopify; // inject instance
  next();
}

// Routes (mounted at /api)
app.use('/api', ensureShopifyReady, authRouter);                // /api/auth, /api/auth/callback
app.use('/api/customers', ensureShopifyReady, customersRoute);
if (theme?.router) app.use('/api/theme', ensureShopifyReady, theme.router);
if (webhooks?.router) app.use('/api/webhooks', ensureShopifyReady, webhooks.router);

// Serve the React app
app.use(express.static(path.join(__dirname, '..', 'web', 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'dist', 'index.html'));
});

// Boot
(async () => {
  try {
    const shopify = await initShopify();
    app.locals.shopify = shopify;

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on :${PORT}`));
  } catch (e) {
    console.error('Failed to init Shopify:', e);
    process.exit(1);
  }
})();
