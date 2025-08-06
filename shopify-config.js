import pkg from "@shopify/shopify-api";
const { shopifyApi, LATEST_API_VERSION, MemorySessionStorage } = pkg;


const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SCOPES.split(","),
  hostName: process.env.HOST.replace(/^https?:\/\//, ""),
  isEmbeddedApp: true,
  apiVersion: LATEST_API_VERSION,
  sessionStorage: new MemorySessionStorage(),
});

export { shopify };
