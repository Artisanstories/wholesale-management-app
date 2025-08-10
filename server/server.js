// server/server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const { initShopify } = require('./shopify-config');
const authRouter = require('./auth');
const customersRoute = require('./routes/customers');

const app = express();
app.set('trust proxy', 1); // important on Render for secure cookies

app.use(cookieParser());
app.use(express.json());

(async () => {
  try {
    const shopify = await initShopify();
    // attach the SDK to every /api request
    app.use((req, _res, next) => { req.shopify = shopify; next(); });

    // API routes
    app.use('/api', authRouter);             // /api/auth, /api/auth/inline, /api/auth/callback, /api/ensure-auth
    app.use('/api/customers', customersRoute);

    // Serve the built React app
    app.use(express.static(path.join(__dirname, '..', 'web', 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, '..', 'web', 'dist', 'index.html'));
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on :${PORT}`));
  } catch (e) {
    console.error('Failed to init Shopify:', e);
    process.exit(1);
  }
})();
