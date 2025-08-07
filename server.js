// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { shopify } from "./shopify-config.js";
import applyAuthMiddleware from "./auth.js";

dotenv.config();
const app = express();

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Render proxy so secure cookies work
app.set("trust proxy", 1);

// Force HTTPS + canonical host to avoid lost OAuth cookies
const expectedHost = (process.env.HOST || process.env.APP_URL || "").replace(/^https?:\/\//, "");
app.use((req, res, next) => {
  if (!expectedHost) return next();
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const host = req.get("host");
  if (proto !== "https") return res.redirect(301, `https://${expectedHost}${req.originalUrl}`);
  if (host !== expectedHost) return res.redirect(301, `https://${expectedHost}${req.originalUrl}`);
  next();
});

// JSON & CORS
app.use(cors());
app.use(express.json());

// ---------- AUTH ----------
applyAuthMiddleware(app);

// ---------- EMBEDDED APP (serve with API key injection) ----------
app.get("/app", (req, res) => {
  const htmlPath = path.join(__dirname, "public", "embedded.html");
  fs.readFile(htmlPath, "utf8", (err, html) => {
    if (err) {
      console.error("[/app] missing embedded.html:", err?.message);
      return res.status(500).send("Missing embedded.html");
    }
    // inject API key
    const injected = html.replace(/%SHOPIFY_API_KEY%/g, String(process.env.SHOPIFY_API_KEY || ""));
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // stop any caching of the embedded UI
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.send(injected);
  });
});

// Root always redirects to embedded UI, preserving shop/host
app.get("/", (req, res) => {
  const { shop, host } = req.query || {};
  const to = `/app${shop || host ? `?${new URLSearchParams({ ...(shop && { shop }), ...(host && { host }) }).toString()}` : ""}`;
  return res.redirect(to);
});

// Health check
app.get("/api/me", (_req, res) => {
  res.json({ success: true, message: "Shopify wholesale app running ✅" });
});

// After routes, expose static assets (images, css, etc.)
app.use(express.static(path.join(__dirname, "public"), { maxAge: 0 }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[startup] Server running on port ${PORT}`);
});
