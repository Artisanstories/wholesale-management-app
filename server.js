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

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Trust Render's proxy so Secure/SameSite=None cookies work
app.set("trust proxy", 1);

// Force HTTPS and the canonical host (prevents lost OAuth cookies)
const expectedHost = (process.env.HOST || process.env.APP_URL || "").replace(/^https?:\/\//, "");
app.use((req, res, next) => {
  if (!expectedHost) return next();
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const host = req.get("host");

  if (proto !== "https") {
    return res.redirect(301, `https://${expectedHost}${req.originalUrl}`);
  }
  if (host !== expectedHost) {
    return res.redirect(301, `https://${expectedHost}${req.originalUrl}`);
  }
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// OAuth routes
applyAuthMiddleware(app);

// Serve embedded page and inject API key at runtime
app.get("/embedded", (_req, res) => {
  const filePath = path.join(__dirname, "public", "embedded.html");
  fs.readFile(filePath, "utf8", (err, html) => {
    if (err) {
      console.error("[embedded] missing file:", err?.message);
      return res.status(500).send("Missing embedded.html");
    }
    const injected = html.replace(
      "%SHOPIFY_API_KEY%",
      String(process.env.SHOPIFY_API_KEY || "")
    );
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(injected);
  });
});

// Health check
app.get("/api/me", (_req, res) => {
  res.send({ success: true, message: "Shopify wholesale app running ✅" });
});

/* --- Optional cookie diagnostics (remove after testing) ---
app.get("/__cookie-set", (req, res) => {
  res.cookie("test_cookie", "ok", { httpOnly: true, secure: true, sameSite: "none" });
  res.send("set");
});
app.get("/__cookie-get", (req, res) => {
  res.send(`cookies: ${req.headers.cookie || "(none)"}`);
});
----------------------------------------------------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[startup] Server running on port ${PORT}`);
});
