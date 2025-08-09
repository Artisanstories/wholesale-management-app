// REQUIRED: load the Node adapter before using shopifyApi
import "@shopify/shopify-api/adapters/node";

import { shopifyApi, LATEST_API_VERSION, MemorySessionStorage } from "@shopify/shopify-api";
import { PostgreSQLSessionStorage } from "@shopify/shopify-app-session-storage-postgresql";
import dotenv from "dotenv";
dotenv.config();

function makeDbUrl() {
  let url = process.env.DATABASE_URL || "";
  if (!url) return "";
  // Render Postgres needs SSL
  if (!/sslmode=/.test(url)) {
    url += (url.includes("?") ? "&" : "?") + "sslmode=require";
  }
  return url;
}

const dbUrl = makeDbUrl();

// Use Postgres if DATABASE_URL is set; otherwise fall back to in-memory sessions
const sessionStorage = dbUrl
  ? new PostgreSQLSessionStorage(dbUrl, { sessionTableName: "shopify_sessions" })
  : new MemorySessionStorage();

if (!dbUrl) {
  console.warn("[sessions] DATABASE_URL not set — using MemorySessionStorage (sessions reset on deploy).");
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
  sessionStorage,
  logger: { level: 0 }
});
