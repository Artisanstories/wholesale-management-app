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

  // Render is behind a proxy; required for secure cookies & correct proto
  app.set('trust proxy', 1);

  app.use(cookieParser());
  app.use(express.json());

  // Keep-alive helps avoid intermittent 502s on free tier cold starts
  app.use((_req, res, next) => {
    res.setHeader('Connection', 'keep-alive');
    next();
  });

  // Health check (configure Render "Health Check Path" = /api/health)
  app.get('/api/health', (_req, res) => res.status(200).send('ok'));

  // Init Shopify SDK
  const shopify = await initShopify();

  // Expose SDK to all downstream handlers
  app.use((req, _res, next) => {
    req.shopify = shopify;
    next();
  });

  // ----- Auth routes -----
  app.use('/api/auth', authRouter);

  // Ensure-auth used by frontend on mount
  app.get('/api/ensure-auth', async (req, res) => {
    try {
      const sessionId = await shopify.session.getCurrentId({
        isOnline: true,
        rawRequest: req,
        rawResponse: res,
      });

      if (!sessionId) {
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

  // ----- API routes -----
  app.use('/api/customers', customersRoute);

  // Global error handler (prevents raw 502s surfacing)
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
