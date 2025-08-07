// auth.js

import { shopify } from "./shopify-config.js";

export default function applyAuthMiddleware(app) {
  app.get("/auth", async (req, res) => {
    const shop = req.query.shop;
    if (!shop) {
      return res.status(400).send("Missing shop parameter.");
    }

    const authRoute = await shopify.auth.begin({
      shop,
      callbackPath: "/auth/callback",
      isOnline: false,
    });

    res.redirect(authRoute);
  });

  app.get("/auth/callback", async (req, res) => {
    try {
      const callback = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      res.redirect(`/?shop=${callback.session.shop}`);
    } catch (err) {
      console.error(err);
      res.status(500).send("Auth callback failed");
    }
  });
}
