// auth.js
import { shopify } from "./shopify-config.js";

function isValidShopDomain(shop) {
  return typeof shop === "string" && /\.myshopify\.com$/i.test(shop);
}

export default function applyAuthMiddleware(app) {
  // Begin OAuth
  app.get("/auth", async (req, res) => {
    try {
      const shop = req.query.shop;

      if (!shop) {
        return res.status(400).send("Missing ?shop=your-store.myshopify.com");
      }
      if (!isValidShopDomain(shop)) {
        return res.status(400).send("Invalid shop domain. Use mystore.myshopify.com");
      }

      console.log("[auth.begin] →", {
        shop,
        hostEnv: process.env.HOST,
        hostUsed: shopify.config.hostName,
        scopes: shopify.config.scopes,
        isEmbeddedApp: shopify.config.isEmbeddedApp,
      });

      const redirectUrl = await shopify.auth.begin({
        shop,
        callbackPath: "/auth/callback",
        isOnline: false,
        rawRequest: req,
        rawResponse: res,
      });

      if (redirectUrl) return res.redirect(redirectUrl);
      return;
    } catch (err) {
      console.error("[auth.begin][ERROR]:", { message: err?.message, stack: err?.stack });
      return res
        .status(500)
        .send(`Auth start failed: ${err?.message || "unknown error"}`);
    }
  });

  // OAuth Callback
  app.get("/auth/callback", async (req, res) => {
    try {
      console.log("[auth.callback] query:", req.query);
      console.log("[auth.callback] cookies:", req.headers.cookie ? "(present)" : "(none)");

      const result = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      const shop = result.session.shop;
      const host = req.query.host || ""; // Shopify sends a base64-encoded host param

      console.log("[auth.callback] OK for", shop);
      // 👉 Land on the embedded page inside Admin
      return res.redirect(`/embedded?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`);
    } catch (err) {
      console.error("[auth.callback][ERROR]:", { message: err?.message, stack: err?.stack });
      return res
        .status(500)
        .send(`Authentication failed: ${err?.message || "unknown error"}`);
    }
  });
}
