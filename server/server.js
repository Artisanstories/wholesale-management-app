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

  // Render sits behind a proxy; needed for secure cookies & correct proto
  app.set('trust proxy', 1);

  app.use(cookieParser());
  app.use(express.json());

  // Keep-alive header helps on free-tier cold starts
  app.use((_req, res, next) => {
    res.setHeader('Connection', 'keep-alive');
    next();
  });

  // Health check (set Render "Health Check Path" = /api/health)
  app.get('/api/health', (_req, res) => res.status(200).send('ok'));

  // Init Shopify SDK
  const shopify = await initShopify();

  // Expose SDK to downstream routes
  app.use((req, _res, next) => {
    req.shopify = shopify;
    next();
  });

  // ----- Auth routes -----
  app.use('/api/auth', authRouter);

  // Ensure-auth used by the frontend on mount.
  // IMPORTANT: Skip getCurrentId() if there's no Bearer token to avoid noisy logs.
  app.get('/api/ensure-auth', async (req, res) => {
    try {
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ')) {
        const shop = (req.query.shop || '').toString();
        return res
          .status(401)
          .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
          .set(
            'X-Shopify-API-Request-Failure-Reauthorize-Url',
            `/api/auth?shop=${encodeURIComponent(shop)}`
          )
          .send('Unauthorized');
      }

      const sessionId = await shopify.session.getCurrentId({
        isOnline: true,
        rawRequest: req,
        rawResponse: res,
      });

      if (!sessionId) {
        const shop = (req.query.shop || '').toString();
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

  // ----- API routes -----
  app.use('/api/customers', customersRoute);

  // Global error handler (prevents raw 502s)
  app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // ----- Static frontend (Vite build) -----
  const distDir = path.join(__dirname, '..', 'web', 'dist');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

  // ----- Start -----
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => console.log(`Server running on :${PORT}`));

  // Tune timeouts for proxy keep-alives
  server.keepAliveTimeout = 61_000;
  server.headersTimeout = 65_000;

  // Graceful shutdown & safety nets
  process.on('SIGINT', () => server.close(() => process.exit(0)));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
  process.on('uncaughtException', (e) => console.error('uncaughtException', e));
})().catch((e) => {
  console.error('Failed to start server:', e);
  process.exit(1);
});
