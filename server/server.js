// server/server.js
require('dotenv').config();
require('@shopify/shopify-api/adapters/node'); // must be first

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const { initShopify } = require('./shopify-config');
const customersRoute = require('./routes/customers');
const authRouter = require('./auth');

(async () => {
  const app = express();

  // Render is behind a proxy
  app.set('trust proxy', 1);

  app.use(cookieParser());
  app.use(express.json());

  // Health check (set Render -> Health Check Path = /api/health)
  app.get('/api/health', (_req, res) => res.status(200).send('ok'));

  const shopify = initShopify();

  // Expose SDK to routes
  app.use((req, _res, next) => {
    req.shopify = shopify;
    next();
  });

  // Auth
  app.use('/api/auth', authRouter);

  // Used by frontend on mount to verify session. Do NOT decode JWT yourself.
  app.get('/api/ensure-auth', async (req, res) => {
    try {
      const sessionId = await shopify.session.getCurrentId({
        isOnline: true,
        rawRequest: req,
        rawResponse: res,
      });

      if (!sessionId) {
        const shop =
          String(req.query.shop || req.headers['x-shopify-shop-domain'] || '');
        return res
          .status(401)
          .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
          .set(
            'X-Shopify-API-Request-Failure-Reauthorize-Url',
            `/api/auth?shop=${encodeURIComponent(shop)}`
          )
          .send('Unauthorized');
      }

      return res.status(204).end();
    } catch (e) {
      console.error('ensure-auth error', e);
      return res.status(401).send('Unauthorized');
    }
  });

  // API routes
  app.use('/api/customers', customersRoute);

  // Global error handler
  app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // Static frontend
  const distDir = path.join(__dirname, '..', 'web', 'dist');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => console.log(`Server running on :${PORT}`));

  server.keepAliveTimeout = 61_000;
  server.headersTimeout = 65_000;

  process.on('SIGINT', () => server.close(() => process.exit(0)));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
})();
