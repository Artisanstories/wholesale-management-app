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
  app.use(cookieParser());
  app.use(express.json());

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

  // --- Static app (Vite build) ---
  app.use(express.static(path.join(__dirname, '..', 'web', 'dist')));
  app.get('*', (_req, res) =>
    res.sendFile(path.join(__dirname, '..', 'web', 'dist', 'index.html'))
  );

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on :${PORT}`));
})().catch((e) => {
  console.error('Failed to start server:', e);
  process.exit(1);
});
