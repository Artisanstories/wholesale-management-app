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

  // Render is behind a proxy; this is required for secure cookies to work
  app.set('trust proxy', 1);

  app.use(cookieParser());
  app.use(express.json());

  // Health check for Render (prevents 502 during deploy/start)
  app.get('/api/health', (_req, res) => res.status(200).send('ok'));

  const shopify = await initShopify();

  // expose SDK to routes
  app.use((req, _res, next) => {
    req.shopify = shopify;
    next();
  });

  // Auth
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

  // API routes
  app.use('/api/customers', customersRoute);

  // Global error handler (so Render doesn’t show 502)
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

  // A little breathing room for proxy keep-alives
  server.keepAliveTimeout = 61000;
  server.headersTimeout = 65000;
})().catch((e) => {
  console.error('Failed to start server:', e);
  process.exit(1);
});
