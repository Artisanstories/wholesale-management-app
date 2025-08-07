// auth.js
import { shopify } from "./shopify-config.js";

function isValidShopDomain(shop) {
  return typeof shop === "string" && /\.myshopify\.com$/i.test(shop);
}

export default function applyAuthMiddleware(app) {
  app.get("/auth", async (req, res) => {
    try {
      const shop = req.query.shop;
      if (!shop) return res.status(400).send("Missing ?shop=");
      if (!isValidShopDomain(shop)) {
        return res.status(400).send("Invalid shop domain. Use mystore.myshopify.com");
      }

      // Log what we're using for quick diagnosis (no secrets)
      console.log("AUTH BEGIN →", {
        shop,
        hostEnv: process.env.HOST,
        hostUsed: shopify.config.hostName,
        scopes: shopify.config.scopes,
        isEmbeddedApp: shopify.config.isEmbeddedApp,
      });

      const authRoute = await shopify.auth.begin({
        shop,
        callbackPath: "/auth/callback",
        isOnline: false,
      });

      return res.redirect(authRoute);
    } catch (err) {
      console.error("ERROR /auth:", err?.message, err);
      return res.status(500).send("Auth start failed");
    }
  });

  app.get("/auth/callback", async (req, res) => {
    try {
      const callback = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });
      console.log("AUTH CALLBACK OK for", callback.session.shop);
      return res.redirect(`/?shop=${callback.session.shop}`);
    } catch (err) {
      console.error("ERROR /auth/callback:", err?.message, err);
      return res.status(500).send("Authentication failed");
    }
  });
}
