import express from "express";
import cookieParser from "cookie-parser";
import { shopify } from "./shopify.js";

const router = express.Router();
router.use(cookieParser());

router.get("/auth", async (req, res) => {
  try {
    const { shop } = req.query;
    if (!shop) return res.status(400).send("Missing shop");
    const authRoute = await shopify.auth.begin({
      shop,
      callbackPath: "/api/auth/callback",
      isOnline: false,
      rawRequest: req,
      rawResponse: res
    });
    return res.redirect(authRoute);
  } catch (e) {
    console.error(e);
    return res.status(500).send("Auth error");
  }
});

router.get("/auth/callback", async (req, res) => {
  try {
    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res
    });
    // Store minimal session in a cookie (for demo). You can swap to DB later.
    res.cookie(process.env.SESSION_COOKIE_NAME || "app_session", JSON.stringify({
      shop: session.shop,
      accessToken: session.accessToken
    }), { httpOnly: true, sameSite: "lax", secure: true, path: "/" });

    // redirect back to embedded app within admin
    const host = req.query.host;
    return res.redirect(`/app?shop=${encodeURIComponent(session.shop)}&host=${encodeURIComponent(host)}`);
  } catch (e) {
    console.error(e);
    return res.status(500).send("Callback error");
  }
});

export default router;
