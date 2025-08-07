// auth.js
import { shopify } from "./shopify-config.js";

// simple validator: must end with .myshopify.com
function isValidShopDomain(shop) {
  return typeof shop === "string" && /\.myshopify\.com$/i.test(shop);
}

export default function applyAuthMiddleware(app) {
  app.get("/auth", async (req, res) => {
    try {
      const shop = req.query.shop;

      if (!shop) {
        return res.status(400).send("Missing ?shop=your-store.myshopify.com");
      }
      if (!isValidShopDomain(shop)) {
        return res
          .status(400)
          .send("Invalid shop domain. Use your real store like mystore.myshopify.com");
      }

      const authRoute = await shopify.auth.begin({
        shop,
        callbackPath: "/auth/callback",
        isOnline: false,
      });

      return res.redirect(authRoute);
    } catch (err) {
      console.error("Error in /auth:", err);
      return res.status(500).send("Auth start failed");
    }
  });

  app.get("/auth/callback", async (req, res) => {
    try {
      const callback = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      // success — go back to your app
      return res.redirect(`/?shop=${callback.session.shop}`);
    } catch (err) {
      console.error("Error in /auth/callback:", err);
      return res.status(500).send("Authentication failed");
    }
  });
}
