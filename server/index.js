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

// Protected GraphQL proxy (optional but handy)
app.post("/api/graphql", verifyRequest, async (req, res) => {
  try {
    const { shop, accessToken } = req.shopifySession;
    const client = new shopify.clients.Graphql({ session: { shop, accessToken } });
    const result = await client.request({ data: req.body }); // { query, variables }
    res.json(result.body);
  } catch (e) {
    console.error("GraphQL proxy error:", e);
    res.status(500).json({ error: "GraphQL request failed" });
  }
});

// Wholesale preview — filters out zero-price variants & gift cards
app.get("/api/wholesale/preview", verifyRequest, async (req, res) => {
  try {
    const { shop, accessToken } = req.shopifySession;
    const client = new shopify.clients.Rest({ session: { shop, accessToken } });

    const limit = Number(req.query.limit || 50);
    const discountPct = parseFloat(process.env.WHOLESALE_DISCOUNT_PERCENT || "20");
    const vatPct = parseFloat(process.env.VAT_RATE_PERCENT || "20");
    const discount = discountPct / 100;
    const vat = vatPct / 100;

    const result = await client.get({
      path: "products",
      query: {
        limit,
        fields: "id,title,product_type,status,variants"
      }
    });

    const products = result?.body?.products || [];

    const items = products.flatMap((p) => {
      // Skip gift cards & non-active products
      if ((p.product_type || "").toLowerCase().includes("gift")) return [];
      if (p.status && p.status !== "active") return [];

      return (p.variants || []).flatMap((v) => {
        const retail = Number.parseFloat(v.price);
        if (!Number.isFinite(retail) || retail <= 0) return []; // drop zero/invalid prices

        const wholesale = +(retail * (1 - discount)).toFixed(2);
        const retailIncVat = +(retail * (1 + vat)).toFixed(2);
        const wholesaleIncVat = +(wholesale * (1 + vat)).toFixed(2);

        return [{
          productId: p.id,
          productTitle: p.title,
          variantId: v.id,
          variantTitle: v.title,
          retail,
          wholesale,
          retailIncVat,
          wholesaleIncVat
        }];
      });
    });

    res.json({
      discountPercent: discountPct,
      vatPercent: vatPct,
      currency: "GBP",
      count: items.length,
      items
    });
  } catch (e) {
    console.error("wholesale/preview error:", e);
    res.status(500).json({ error: "Failed to load preview" });
  }
});

// Serve client
const clientDist = path.resolve(__dirname, "../web/dist");
app.use("/assets", express.static(path.join(clientDist, "assets")));
app.get("/app", (req, res) => {
  const cookieName = process.env.SESSION_COOKIE_NAME || "app_session";
  const hasSession = Boolean(req.cookies?.[cookieName]);
  const shop = req.query.shop;

  if (!hasSession && shop) {
    return res.redirect(`/api/auth?shop=${encodeURIComponent(shop)}`);
  }
  if (!hasSession && !shop) {
    return res.redirect("/");
  }
  res.sendFile(path.join(clientDist, "index.html"));
});
app.get("/", (req, res) => {
  const shop = req.query.shop;
  if (shop) return res.redirect(`/api/auth?shop=${encodeURIComponent(shop)}`);
  res.send("Provide ?shop=your-store.myshopify.com to install.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
