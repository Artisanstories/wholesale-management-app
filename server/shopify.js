import "@shopify/shopify-api/adapters/node";
import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
import { PostgreSQLSessionStorage } from "@shopify/shopify-app-session-storage-postgresql";
import dotenv from "dotenv";
dotenv.config();

const storage = new PostgreSQLSessionStorage(process.env.DATABASE_URL, {
  sessionTableName: "shopify_sessions" // optional, defaults to 'shopify_sessions'
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
  sessionStorage: storage,
  logger: { level: 0 }
});
