// server/server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const { initShopify } = require('./shopify-config');
const customersRoute = require('./routes/customers');
const theme = require('./routes/theme');
const webhooks = require('./routes/webhooks');
const authRouter = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

// Inject Shopify instance when ready
function ensureShopifyReady(req, res, next) {
  const shopify = req.app.locals.shopify;
  if (!shopify) return res.status(503).json({ error: 'Shopify not initialized yet' });
  req.shopify = shopify;
  next();
}

// API routes
app.use('/api', ensureShopifyReady, authRouter);
app.use('/api/customers', ensureShopifyReady, customersRoute);
if (theme?.router) app.use('/api/theme', ensureShopifyReady, theme.router);
if (webhooks?.router) app.use('/api/webhooks', ensureShopifyReady, webhooks.router);

// Serve the React build
app.use(express.static(path.join(__dirname, '..', 'web', 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'dist', 'index.html'));
});

// ---- SINGLE-START GUARD ----
global.__AS_SERVER_STARTED__ = global.__AS_SERVER_STARTED__ || false;

(async () => {
  try {
    const shopify = await initShopify();
    app.locals.shopify = shopify;

    if (!global.__AS_SERVER_STARTED__) {
      global.__AS_SERVER_STARTED__ = true;

      const PORT = Number(process.env.PORT) || 3000;
      const server = app.listen(PORT, '0.0.0.0', () =>
        console.log(`Server running on :${PORT}`)
      );

      server.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
          console.warn('[warn] Port already in use; skipping duplicate listener.');
          // Do not throw — let the first instance keep running.
        } else {
          console.error(err);
          process.exit(1);
        }
      });
    } else {
      console.log('[info] Server already started; skipping duplicate listen.');
    }
  } catch (e) {
    console.error('Failed to init Shopify:', e);
    process.exit(1);
  }
})();
