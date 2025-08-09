import { shopifyApi, LATEST_API_VERSION, ApiVersion } from "@shopify/shopify-api";
import dotenv from "dotenv";
dotenv.config();

const apiVersion = (LATEST_API_VERSION ?? ApiVersion.July24);

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: (process.env.SCOPES || "").split(",").map(s => s.trim()).filter(Boolean),
  apiVersion,
  isEmbeddedApp: true,
  hostName: process.env.HOST.replace(/^https?:\/\//, ""),
  logger: { level: 0 }
});
