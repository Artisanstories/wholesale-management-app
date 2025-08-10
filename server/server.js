// server/server.js
require('dotenv').config();
require('@shopify/shopify-api/adapters/node'); // keep first

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const { initShopify } = require('./shopify-config');
const customersRoute = require('./routes/customers');
const authRouter = require('./auth');

(async () => {
  const app = express();

  // Render/ELB sits in front of us; this lets Shopify's secure cookies work.
  app.set('trust proxy', 1);

  app.use(cookieParser());
  app.use(express.json());

  // Health for quick checks
  app.get('/api/health', (_req, res) => res.status(200).send('ok'));

  // Init Shopify SDK
  const shopify = await initShopify();

  // expose the SDK on req for all routes
  app.use((req, _res, next) => {
    req.shopify = shopify;
    next();
  });

  // --- Auth routes ---
  app.use('/api/auth', authRouter);

  // --- “Ensure auth” helper used by the frontend on mount ---
  app.get('/api/ensure-auth', async (req, res) => {
    try {
      const sessionId = await shopify.session.getCurrentId({
        isOnline: true,
        rawRequest: req,
        rawResponse: res,
      });

      if (!sessionId) {
        // The client will read these and call /api/auth/inline
        return res
          .status(401)
          .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
          .send('Unauthorized');
      }

      return res.status(204).end();
    } catch (e) {
      console.error('ensure-auth error', e);
      return res.status(401).send('Unauthorized');
    }
  });

  // --- API routes ---
  app.use('/api/customers', customersRoute);

  // --- Global error handler (prevents 502s) ---
  app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // --- Static app (Vite build) ---
  const distDir = path.join(__dirname, '..', 'web', 'dist');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => console.log(`Server running on :${PORT}`));

  // Slightly longer timeouts help behind a proxy and avoid sporadic 502s
  server.keepAliveTimeout = 61_000;
  server.headersTimeout = 65_000;
})().catch((e) => {
  console.error('Failed to start server:', e);
  process.exit(1);
});
