// server/auth.js
import express from "express";
import cookieParser from "cookie-parser";
import { shopify } from "./shopify.js";
import { injectWholesaleSnippet } from "./routes/theme.js"; 
import { removeWholesaleSnippet } from "./routes/webhooks.js";

const router = express.Router();
router.use(cookieParser());

// Start OAuth
router.get("/auth", async (req, res) => {
  try {
    const { shop } = req.query;
    if (!shop) return res.status(400).send("Missing shop");

    await shopify.auth.begin({
      shop,
      callbackPath: "/api/auth/callback",
      isOnline: false,
      rawRequest: req,
      rawResponse: res
    });
  } catch (e) {
    console.error("Auth begin error:", e);
    if (!res.headersSent) res.status(500).send("Auth error");
  }
});

// OAuth callback
router.get("/auth/callback", async (req, res) => {
  try {
    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res
    });

    // ✅ Inject wholesale snippet automatically after install
    try {
      await injectWholesaleSnippet(session);
      console.log(`✅ Wholesale snippet injected for shop: ${session.shop}`);
    } catch (injectionError) {
      console.error(`❌ Failed to inject snippet for ${session.shop}`, injectionError);
    }

    // ✅ Register uninstall webhook
    try {
      await shopify.webhooks.register({
        session,
        deliveryMethod: shopify.webhooks.DeliveryMethod.Http,
        callbackUrl: "/api/webhooks/uninstalled",
        topic: "APP_UNINSTALLED"
      });
      console.log(`✅ Uninstall webhook registered for shop: ${session.shop}`);
    } catch (webhookError) {
      console.error(`❌ Failed to register uninstall webhook for ${session.shop}`, webhookError);
    }

    // Store a lightweight cookie for your API routes
    res.cookie(
      process.env.SESSION_COOKIE_NAME || "app_session",
      JSON.stringify({
        shop: session.shop,
        accessToken: session.accessToken
      }),
      {
        httpOnly: true,
        secure: true,
        sameSite: "none", // embedded app inside iframe
        path: "/"
      }
    );

    const host = req.query.host || "";
    if (!res.headersSent) {
      return res.redirect(
        `/app?shop=${encodeURIComponent(session.shop)}&host=${encodeURIComponent(host)}`
      );
    }
  } catch (e) {
    console.error("Auth callback error:", e);
    if (!res.headersSent) res.status(500).send("Callback error");
  }
});

export default router;
