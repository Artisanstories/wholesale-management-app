// server/shopify.js
import "@shopify/shopify-api/adapters/node";
import { shopifyApi, LATEST_API_VERSION, MemorySessionStorage } from "@shopify/shopify-api";
import { PostgreSQLSessionStorage } from "@shopify/shopify-app-session-storage-postgresql";
import dotenv from "dotenv";
dotenv.config();

function makeDbUrl() {
  let url = process.env.DATABASE_URL || "";
  if (!url) return "";
  // Ensure sslmode=require for Render Postgres
  if (!/sslmode=/.test(url)) {
    url += (url.includes("?") ? "&" : "?") + "sslmode=require";
  }
  return url;
}

const dbUrl = makeDbUrl();

const storage = dbUrl
  ? new PostgreSQLSessionStorage(dbUrl, { sessionTableName: "shopify_sessions" })
  : new MemorySessionStorage();

if (!dbUrl) {
  console.warn(
    "[sessions] DATABASE_URL not set — using MemorySessionStorage (sessions will reset on deploy)."
  );
}

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: (process.env.SCOPES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
  hostName: process.env.HOST.replace(/^https?:\/\//, ""),
  sessionStorage: storage,
  logger: { level: 0 }
});
