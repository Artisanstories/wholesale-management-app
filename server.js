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

// ESM dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Required so Render’s proxy allows SameSite=None cookies
app.set("trust proxy", 1);

// Force https + canonical host (prevents OAuth cookie loss)
const expectedHost = (process.env.HOST || process.env.APP_URL || "").replace(/^https?:\/\//, "");
app.use((req, res, next) => {
  if (!expectedHost) return next();
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const host = req.get("host");
  if (proto !== "https") return res.redirect(301, `https://${expectedHost}${req.originalUrl}`);
  if (host !== expectedHost) return res.redirect(301, `https://${expectedHost}${req.originalUrl}`);
  next();
});

// Shopify embed CSP (keep it simple; expand later if needed)
app.use((_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors https://admin.shopify.com https://*.myshopify.com;"
  );
  next();
});

app.use(cors());
app.use(express.json());

// OAuth routes
applyAuthMiddleware(app);

// --- Static assets from built client ---
const clientDist = path.join(__dirname, "client", "dist");
app.use("/assets", express.static(path.join(clientDist, "assets")));
app.use("/favicon.ico", express.static(path.join(clientDist, "favicon.ico")));

// Helper to serve embedded UI with API key injection (no cache)
function sendEmbeddedHTML(_req, res) {
  const filePath = path.join(clientDist, "index.html");
  fs.readFile(filePath, "utf8", (err, html) => {
    if (err) {
      console.error("[embedded] missing build:", err?.message);
      return res
        .status(500)
        .send("Client build not found. Did you run `npm run build:client`?");
    }
    const injected = html.replace(/%SHOPIFY_API_KEY%/g, String(process.env.SHOPIFY_API_KEY || ""));
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.send(injected);
  });
}

// Root -> embedded (preserve shop/host when present)
app.get("/", (req, res) => {
  const { shop, host } = req.query || {};
  const search = new URLSearchParams({ ...(shop && { shop }), ...(host && { host }) }).toString();
  res.redirect(`/embedded${search ? `?${search}` : ""}`);
});

// Embedded entry + nested routes
app.get("/embedded", sendEmbeddedHTML);
app.get("/embedded/*", sendEmbeddedHTML);

// Health check
app.get("/api/me", (_req, res) => {
  res.send({ success: true, message: "Shopify wholesale app running ✅" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[startup] Server running on port ${PORT}`));
