import express from "express";
import cookieParser from "cookie-parser";
import { shopify } from "./shopify.js";

const router = express.Router();
router.use(cookieParser());

// Start OAuth — let Shopify send the redirect (we pass rawResponse)
router.get("/auth", async (req, res) => {
  try {
    const { shop } = req.query;
    if (!shop) return res.status(400).send("Missing shop");

    await shopify.auth.begin({
      shop,
      callbackPath: "/api/auth/callback",
      isOnline: false,
      rawRequest: req,
      rawResponse: res, // this writes the redirect
    });

    // IMPORTANT: do not write any more to res after this point
  } catch (e) {
    console.error("Auth begin error:", e);
    if (!res.headersSent) {
      res.status(500).send("Auth error");
    }
  }
});

// OAuth callback — we handle final redirect after session is created
router.get("/auth/callback", async (req, res) => {
  try {
    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res, // lets Shopify set its cookies if any
    });

    // Store a minimal session cookie for your API routes
    res.cookie(process.env.SESSION_COOKIE_NAME || "app_session", JSON.stringify({
      shop: session.shop,
      accessToken: session.accessToken,
    }), {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });

    const host = req.query.host || "";
    if (!res.headersSent) {
      return res.redirect(
        `/app?shop=${encodeURIComponent(session.shop)}&host=${encodeURIComponent(host)}`
      );
    }
  } catch (e) {
    console.error("Auth callback error:", e);
    if (!res.headersSent) {
      res.status(500).send("Callback error");
    }
  }
});

export default router;
