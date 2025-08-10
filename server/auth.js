import express from "express";
import cookieParser from "cookie-parser";
import { shopify } from "./shopify.js";
import { injectWholesaleSnippet } from "./routes/theme.js"; // ✅ add this import

const router = express.Router();
router.use(cookieParser());

// Start OAuth — Shopify writes the redirect via rawResponse.
// Do not call res.redirect() after this.
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
    // nothing else here
  } catch (e) {
    console.error("Auth begin error:", e);
    if (!res.headersSent) res.status(500).send("Auth error");
  }
});

// OAuth callback — create your light cookie for app API routes and redirect once.
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

    // A tiny cookie for your own API routes (Shopify's official session is in Postgres)
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
