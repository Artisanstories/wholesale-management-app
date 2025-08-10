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

  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use(express.json());

  app.use((_req, res, next) => {
    res.setHeader('Connection', 'keep-alive');
    next();
  });

  app.get('/api/health', (_req, res) => res.status(200).send('ok'));

  const shopify = await initShopify();

  app.use((req, _res, next) => {
    req.shopify = shopify;
    next();
  });

  app.use('/api/auth', authRouter);

  // ===== FIXED: no decodeSessionToken, use getCurrentId + storage =====
  app.get('/api/ensure-auth', async (req, res) => {
    try {
      const bearer = req.headers.authorization || '';
      const shopParam = (req.query.shop || '').toString();

      if (!bearer.startsWith('Bearer ')) {
        return res
          .status(401)
          .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
          .set(
            'X-Shopify-API-Request-Failure-Reauthorize-Url',
            `/api/auth/inline${shopParam ? `?shop=${encodeURIComponent(shopParam)}` : ''}`
          )
          .send('Unauthorized');
      }

      const sessionId = await shopify.session.getCurrentId({
        isOnline: true,
        rawRequest: req,
        rawResponse: res,
      });

      if (!sessionId) {
        return res
          .status(401)
          .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
          .set(
            'X-Shopify-API-Request-Failure-Reauthorize-Url',
            `/api/auth/inline${shopParam ? `?shop=${encodeURIComponent(shopParam)}` : ''}`
          )
          .send('Unauthorized');
      }

      const session = await shopify.config.sessionStorage.loadSession(sessionId);
      if (!session) {
        return res
          .status(401)
          .set('X-Shopify-API-Request-Failure-Reauthorize', '1')
          .set(
            'X-Shopify-API-Request-Failure-Reauthorize-Url',
            `/api/auth/inline${shopParam ? `?shop=${encodeURIComponent(shopParam)}` : ''}`
          )
          .send('Unauthorized');
      }

      return res.status(204).end();
    } catch (e) {
      console.error('ensure-auth error', e);
      return res.status(401).send('Unauthorized');
    }
  });
  // ===================================================================

  app.use('/api/customers', customersRoute);

  app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  const distDir = path.join(__dirname, '..', 'web', 'dist');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => console.log(`Server running on :${PORT}`));
  server.keepAliveTimeout = 61_000;
  server.headersTimeout = 65_000;

  process.on('SIGINT', () => server.close(() => process.exit(0)));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
  process.on('uncaughtException', (e) => console.error('uncaughtException', e));
})().catch((e) => {
  console.error('Failed to start server:', e);
  process.exit(1);
});
