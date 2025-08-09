import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import authRouter from "./auth.js";
import { verifyRequest } from "./verifyRequest.js";
import { shopify } from "./shopify.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

/** HTTPS + secure cookies behind Render’s proxy */
app.set("trust proxy", 1);

app.use(cors());
app.use(cookieParser());
app.use(express.json());

// OAuth routes
app.use("/api", authRouter);

// Protected REST example
app.get("/api/products/count", verifyRequest, async (req, res) => {
  try {
    const { shop, accessToken } = req.shopifySession;
    const client = new shopify.clients.Rest({ session: { shop, accessToken } });
    const result = await client.get({ path: "products/count" });
    res.json(result?.body || {});
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch count" });
  }
});

// Protected GraphQL proxy
app.post("/api/graphql", verifyRequest, async (req, res) => {
  try {
    const { shop, accessToken } = req.shopifySession;
    const client = new shopify.clients.Graphql({ session: { shop, accessToken } });

    const result = await client.request({
      data: req.body // { query, variables }
    });

    res.json(result.body);
  } catch (e) {
    console.error("GraphQL proxy error:", e);
    res.status(500).json({ error: "GraphQL request failed" });
  }
});

// Serve client
const clientDist = path.resolve(__dirname, "../web/dist");
app.use("/assets", express.static(path.join(clientDist, "assets")));
app.get("/app", (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});
app.get("/", (req, res) => {
  const shop = req.query.shop;
  if (shop) return res.redirect(`/api/auth?shop=${encodeURIComponent(shop)}`);
  res.send("Provide ?shop=your-store.myshopify.com to install.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
// Preview products with computed wholesale + VAT
app.get("/api/wholesale/preview", verifyRequest, async (req, res) => {
  try {
    const { shop, accessToken } = req.shopifySession;
    const client = new shopify.clients.Rest({ session: { shop, accessToken } });

    const limit = Number(req.query.limit || 25);
    const discountPct = parseFloat(process.env.WHOLESALE_DISCOUNT_PERCENT || "20");
    const vatPct = parseFloat(process.env.VAT_RATE_PERCENT || "20");
    const discount = discountPct / 100;
    const vat = vatPct / 100;

    // Get a small page of products with variants & prices
    const result = await client.get({
      path: "products",
      query: { limit, fields: "id,title,variants" }
    });

    const items = (result?.body?.products || []).flatMap((p) => {
      return (p.variants || []).map((v) => {
        const retail = parseFloat(v.price);
        const wholesale = +(retail * (1 - discount)).toFixed(2);
        const retailIncVat = +(retail * (1 + vat)).toFixed(2);
        const wholesaleIncVat = +(wholesale * (1 + vat)).toFixed(2);
        return {
          productId: p.id,
          productTitle: p.title,
          variantId: v.id,
          variantTitle: v.title,
          retail,
          wholesale,
          retailIncVat,
          wholesaleIncVat
        };
      });
    });

    res.json({
      discountPercent: discountPct,
      vatPercent: vatPct,
      currency: "GBP", // simple display hint; adjust later if needed
      items
    });
  } catch (e) {
    console.error("wholesale/preview error:", e);
    res.status(500).json({ error: "Failed to load preview" });
  }
});
