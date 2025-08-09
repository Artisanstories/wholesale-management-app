// Load the Node adapter BEFORE using shopifyApi
import "@shopify/shopify-api/adapters/node";

import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import { PostgreSQLSessionStorage } from "@shopify/shopify-app-session-storage-postgresql";
import dotenv from "dotenv";
dotenv.config();

/** Ensure the DB URL exists and has SSL for Render */
function getDbUrl() {
  let url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is missing. Add it in Render → Environment.");
  }
  if (!/sslmode=/.test(url)) {
    url += (url.includes("?") ? "&" : "?") + "sslmode=require";
  }
  return url;
}

const sessionStorage = new PostgreSQLSessionStorage(getDbUrl(), {
  sessionTableName: "shopify_sessions",
});

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
  logger: { level: 0 },
});
