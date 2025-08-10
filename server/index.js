import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import authRouter from "./auth.js";
import { verifyRequest } from "./verifyRequest.js";
import { shopify } from "./shopify.js";
import {
  ensureTables,
  getSettingsForShop,
  saveSettingsForShop,
  getRules,
  upsertRule,
  deleteRule,
  getDiscountForTags,
} from "./db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

/** HTTPS + secure cookies behind Render’s proxy */
app.set("trust proxy", 1);

app.use(cors());
app.use(cookieParser());
app.use(express.json());

// Ensure DB tables exist on boot
await ensureTables().catch((e) => console.error("[DB] ensureTables failed:", e));

// OAuth routes
app.use("/api", authRouter);

/* ---------- Simple protected example ---------- */
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

/* ---------- GraphQL proxy (optional) ---------- */
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

/* ---------- SETTINGS (per-shop) ---------- */

// Get current settings for this shop (DB -> fallback to env)
app.get("/api/settings", verifyRequest, async (req, res) => {
  try {
    const { shop } = req.shopifySession;
    const defaults = {
      discountPercent: parseFloat(process.env.WHOLESALE_DISCOUNT_PERCENT || "20"),
      vatPercent: parseFloat(process.env.VAT_RATE_PERCENT || "20"),
    };
    const saved = await getSettingsForShop(shop);
    res.json({
      discountPercent: saved?.discountPercent ?? defaults.discountPercent,
      vatPercent: saved?.vatPercent ?? defaults.vatPercent,
    });
  } catch (e) {
    console.error("GET /api/settings error:", e);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

// Save base settings for this shop
app.post("/api/settings", verifyRequest, async (req, res) => {
  try {
    const { shop } = req.shopifySession;
    const { discountPercent, vatPercent } = req.body || {};
    const d = Number(discountPercent);
    const v = Number(vatPercent);
    if (!Number.isFinite(d) || d < 0 || d > 100) {
      return res.status(400).json({ error: "discountPercent must be 0-100" });
    }
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      return res.status(400).json({ error: "vatPercent must be 0-100" });
    }
    await saveSettingsForShop(shop, d, v);
    res.json({ ok: true, discountPercent: d, vatPercent: v });
  } catch (e) {
    console.error("POST /api/settings error:", e);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

/* ---------- TAG RULES (per-shop) ---------- */

// List rules
app.get("/api/rules", verifyRequest, async (req, res) => {
  try {
    const { shop } = req.shopifySession;
    const rules = await getRules(shop);
    res.json({ rules });
  } catch (e) {
    console.error("GET /api/rules error:", e);
    res.status(500).json({ error: "Failed to load rules" });
  }
});

// Add / update a rule
app.post("/api/rules", verifyRequest, async (req, res) => {
  try {
    const { shop } = req.shopifySession;
    const { tag, discountPercent } = req.body || {};
    const t = String(tag || "").trim().toLowerCase();
    const d = Number(discountPercent);
    if (!t) return res.status(400).json({ error: "tag is required" });
    if (!Number.isFinite(d) || d < 0 || d > 100) {
      return res.status(400).json({ error: "discountPercent must be 0-100" });
    }
    await upsertRule(shop, t, d);
    const rules = await getRules(shop);
    res.json({ ok: true, rules });
  } catch (e) {
    console.error("POST /api/rules error:", e);
    res.status(500).json({ error: "Failed to save rule" });
  }
});

// Delete a rule
app.delete("/api/rules/:tag", verifyRequest, async (req, res) => {
  try {
    const { shop } = req.shopifySession;
    const tag = String(req.params.tag || "").trim().toLowerCase();
    if (!tag) return res.status(400).json({ error: "tag is required" });
    await deleteRule(shop, tag);
    const rules = await getRules(shop);
    res.json({ ok: true, rules });
  } catch (e) {
    console.error("DELETE /api/rules error:", e);
    res.status(500).json({ error: "Failed to delete rule" });
  }
});

/* ---------- CUSTOMER SEARCH ---------- */

app.get("/api/customers/search", verifyRequest, async (req, res) => {
  try {
    const { shop, accessToken } = req.shopifySession;
    const q = String(req.query.q || "").trim();
    if (!q) return res.json({ customers: [] });

    const client = new shopify.clients.Rest({ session: { shop, accessToken } });
    const result = await client.get({
      path: "customers/search",
      query: { query: q, limit: 10, fields: "id,first_name,last_name,email,tags" },
    });

    const customers = (result?.body?.customers || []).map((c) => ({
      id: c.id,
      email: c.email || "",
      name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
      tags: (c.tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    }));

    res.json({ customers });
  } catch (e) {
    console.error("GET /api/customers/search error:", e);
    res.status(500).json({ error: "Customer search failed" });
  }
});

/* ---------- WHOLESALE PREVIEW (with customer filter) ---------- */

app.get("/api/wholesale/preview", verifyRequest, async (req, res) => {
  try {
    const { shop, accessToken } = req.shopifySession;
    const client = new shopify.clients.Rest({ session: { shop, accessToken } });

    const limit = Number(req.query.limit || 50);
    const customerId = req.query.customerId ? String(req.query.customerId) : null;

    // Base settings (defaults → DB)
    const defaults = {
      discountPercent: parseFloat(process.env.WHOLESALE_DISCOUNT_PERCENT || "20"),
      vatPercent: parseFloat(process.env.VAT_RATE_PERCENT || "20"),
    };
    const saved = await getSettingsForShop(shop);
    const defaultDiscount = saved?.discountPercent ?? defaults.discountPercent;
    const vatPct = saved?.vatPercent ?? defaults.vatPercent;

    // If a customer is provided, fetch tags and compute best discount from rules
    let effectiveDiscount = defaultDiscount;
    let customer = null;

    if (customerId) {
      const customerRes = await client.get({
        path: `customers/${customerId}`,
        query: { fields: "id,first_name,last_name,email,tags" },
      });
      const c = customerRes?.body?.customer;
      if (c) {
        const tags = (c.tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        effectiveDiscount = await getDiscountForTags(shop, tags, defaultDiscount);
        customer = {
          id: c.id,
          email: c.email || "",
          name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
          tags,
        };
      }
    }

    const discount = effectiveDiscount / 100;
    const vat = vatPct / 100;

    const result = await client.get({
      path: "products",
      query: {
        limit,
        fields: "id,title,product_type,status,variants",
      },
    });

    const products = result?.body?.products || [];

    const items = products.flatMap((p) => {
      if ((p.product_type || "").toLowerCase().includes("gift")) return [];
      if (p.status && p.status !== "active") return [];

      return (p.variants || []).flatMap((v) => {
        const retail = Number.parseFloat(v.price);
        if (!Number.isFinite(retail) || retail <= 0) return [];

        const wholesale = +(retail * (1 - discount)).toFixed(2);
        const retailIncVat = +(retail * (1 + vat)).toFixed(2);
        const wholesaleIncVat = +(wholesale * (1 + vat)).toFixed(2);

        return [
          {
            productId: p.id,
            productTitle: p.title,
            variantId: v.id,
            variantTitle: v.title,
            retail,
            wholesale,
            retailIncVat,
            wholesaleIncVat,
          },
        ];
      });
    });

    res.json({
      discountPercent: effectiveDiscount,
      vatPercent: vatPct,
      currency: "GBP",
      count: items.length,
      customer,
      items,
    });
  } catch (e) {
    console.error("wholesale/preview error:", e);
    res.status(500).json({ error: "Failed to load preview" });
  }
});

/* ---------- CSV Export (supports customerId + VAT toggle) ---------- */

app.get("/api/wholesale/export.csv", verifyRequest, async (req, res) => {
  try {
    const { shop, accessToken } = req.shopifySession;
    const client = new shopify.clients.Rest({ session: { shop, accessToken } });

    const limit = Number(req.query.limit || 100);
    const customerId = req.query.customerId ? String(req.query.customerId) : null;

    // Base settings (defaults → DB)
    const defaults = {
      discountPercent: parseFloat(process.env.WHOLESALE_DISCOUNT_PERCENT || "20"),
      vatPercent: parseFloat(process.env.VAT_RATE_PERCENT || "20"),
    };
    const saved = await getSettingsForShop(shop);
    const defaultDiscount = saved?.discountPercent ?? defaults.discountPercent;
    const vatPct = saved?.vatPercent ?? defaults.vatPercent;

    // Effective discount via tag rules
    let effectiveDiscount = defaultDiscount;
    if (customerId) {
      const cRes = await client.get({
        path: `customers/${customerId}`,
        query: { fields: "id,tags" },
      });
      const c = cRes?.body?.customer;
      if (c) {
        const tags = (c.tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        effectiveDiscount = await getDiscountForTags(shop, tags, defaultDiscount);
      }
    }

    const discount = effectiveDiscount / 100;
    const vat = vatPct / 100;

    const result = await client.get({
      path: "products",
      query: {
        limit,
        fields: "id,title,product_type,status,variants",
      },
    });

    const products = result?.body?.products || [];

    const items = products.flatMap((p) => {
      if ((p.product_type || "").toLowerCase().includes("gift")) return [];
      if (p.status && p.status !== "active") return [];

      return (p.variants || []).flatMap((v) => {
        const retail = Number.parseFloat(v.price);
        if (!Number.isFinite(retail) || retail <= 0) return [];

        const wholesale = +(retail * (1 - discount)).toFixed(2);
        const retailIncVat = +(retail * (1 + vat)).toFixed(2);
        const wholesaleIncVat = +(wholesale * (1 + vat)).toFixed(2);

        return [
          {
            productTitle: p.title,
            variantTitle: v.title || "",
            retail,
            wholesale,
            retailIncVat,
            wholesaleIncVat,
            productId: p.id,
            variantId: v.id,
          },
        ];
      });
    });

    const headers = [
      "Product",
      "Variant",
      "Retail (ex VAT)",
      "Wholesale (ex VAT)",
      "Retail (inc VAT)",
      "Wholesale (inc VAT)",
      "Product ID",
      "Variant ID",
    ];

    const escape = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    const rows = items.map((i) =>
      [
        i.productTitle,
        i.variantTitle,
        i.retail.toFixed(2),
        i.wholesale.toFixed(2),
        i.retailIncVat.toFixed(2),
        i.wholesaleIncVat.toFixed(2),
        i.productId,
        i.variantId,
      ]
        .map(escape)
        .join(",")
    );

    const csv = [headers.map(escape).join(","), ...rows].join("\n");
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="wholesale_preview_${stamp}.csv"`
    );
    res.send(csv);
  } catch (e) {
    console.error("wholesale/export.csv error:", e);
    res.status(500).send("Failed to export CSV");
  }
});

/* ---------- STATIC & INSTALL ---------- */

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
