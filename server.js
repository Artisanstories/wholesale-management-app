// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import applyAuthMiddleware from "./auth.js";

dotenv.config();

const app = express();

// --- ESM __dirname shim ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Trust Render proxy for Secure/SameSite=None cookies ---
app.set("trust proxy", 1);

// --- Force HTTPS + canonical host to preserve OAuth cookies ---
const expectedHost = (process.env.HOST || process.env.APP_URL || "")
  .replace(/^https?:\/\//, "");
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

// --- Common middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// --- OAuth routes ---
applyAuthMiddleware(app);

// --- Root redirect: Admin will open "/" with ?shop & ?host ---
app.get("/", (req, res) => {
  const { shop, host } = req.query || {};
  if (shop && host) {
    return res.redirect(
      `/embedded?shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(
        host
      )}`
    );
  }
  // Fallback if opened directly without params
  return res.redirect("/embedded");
});

// --- Embedded UI: inject API key into public/embedded.html ---
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

// --- Health check ---
app.get("/api/me", (_req, res) => {
  res.send({ success: true, message: "Shopify wholesale app running ✅" });
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[startup] Server running on port ${PORT}`);
});
