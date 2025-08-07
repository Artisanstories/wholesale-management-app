// auth.js
import { shopify } from "./shopify-config.js";

export default function applyAuthMiddleware(app) {
  // Start OAuth
  app.get("/auth", async (req, res) => {
    try {
      const shop = req.query.shop;
      if (!shop) return res.status(400).send("Missing shop parameter.");

      const authRoute = await shopify.auth.begin({
        shop,
        callbackPath: "/auth/callback",
        isOnline: false,
      });

      return res.redirect(authRoute);
    } catch (err) {
      console.error("[auth.begin][ERROR]", err);
      return res.status(500).send("Auth start failed");
    }
  });

  // Finish OAuth
  app.get("/auth/callback", async (req, res) => {
    try {
      const { session } = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      // Shopify includes base64 `host` in the query
      const host = req.query.host || "";
      const shop = session.shop;

      // ✅ Land on embedded UI
      return res.redirect(`/embedded?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`);
    } catch (err) {
      console.error("[auth.callback][ERROR]", err);
      return res.status(400).send("Authentication failed: Invalid OAuth callback.");
    }
  });
}
