// server/routes/customers.js
// Express route for the Customer Filter UI in App.tsx
// Compatible with @shopify/shopify-api ^7.4.0 and Express.

/**
 * Query params supported:
 *  - search: string (matches name, email, company)
 *  - status: comma-separated: pending|approved|rejected
 *  - tags:   comma-separated customer tags (all must match)
 *  - limit:  number per page (default 100, max 250)
 */

const express = require("express");
const router = express.Router();

// Adjust import if your config file path/name differs
const { shopify } = require("../shopify-config");

// ---- Tag → status mapping (edit to match your store) ----
const TAGS = {
  approved: ["wholesale-approved", "approved", "wholesale"],
  pending: ["wholesale-pending", "pending"],
  rejected: ["wholesale-rejected", "rejected"],
};

function mapStatusFromCustomer(c) {
  const tagList = (c.tags || "")
    .split(",")
    .map((t) => t.trim().toLowerCase());
  if (tagList.some((t) => TAGS.approved.includes(t))) return "approved";
  if (tagList.some((t) => TAGS.rejected.includes(t))) return "rejected";
  if (tagList.some((t) => TAGS.pending.includes(t))) return "pending";
  return "pending"; // default
}

function toClientCustomer(c) {
  return {
    id: String(c.id),
    name:
      [c.first_name, c.last_name].filter(Boolean).join(" ") ||
      c.email ||
      "Customer",
    email: c.email || "",
    company: c.default_address?.company || c.note || "",
    tags: (c.tags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    status: mapStatusFromCustomer(c),
    createdAt: c.created_at,
  };
}

function filterCustomers(list, { search = "", statuses = [], tags = [] }) {
  const q = search.trim().toLowerCase();
  return list.filter((c) => {
    const matchQ =
      !q ||
      [c.first_name, c.last_name, c.email, c.default_address?.company, c.note]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));

    const clientShape = toClientCustomer(c);
    const matchS = statuses.length === 0 || statuses.includes(clientShape.status);
    const matchT =
      tags.length === 0 ||
      tags.every((t) =>
        clientShape.tags.map((x) => x.toLowerCase()).includes(t)
      );

    return matchQ && matchS && matchT;
  });
}

// GET /api/customers
router.get("/", async (req, res) => {
  try {
    // Get session (depends on your auth middleware). This pattern works with most scaffolds:
    const sessionId =
      res.locals.shopify?.session?.id || req.query.session_id || null;
    const session = await shopify.config.sessionStorage.loadSession(sessionId);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const search = String(req.query.search || "");
    const statuses = String(req.query.status || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const tags = String(req.query.tags || "")
      .toLowerCase()
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const limit = Math.min(parseInt(req.query.limit || "100", 10) || 100, 250);

    const admin = new shopify.api.clients.Rest({ session });

    let collected = [];
    let pageInfo = undefined;
    let pagesFetched = 0;
    const maxPages = 2; // keep cheap on Render; increase if needed

    do {
      const resp = await admin.get({
        path: "customers",
        query: {
          limit,
          fields:
            "id,first_name,last_name,email,created_at,note,tags,default_address",
          page_info: pageInfo?.nextPage?.query?.page_info,
        },
      });

      const items = Array.isArray(resp?.body?.customers)
        ? resp.body.customers
        : [];
      collected.push(...filterCustomers(items, { search, statuses, tags }));

      pageInfo = resp.pageInfo;
      pagesFetched += 1;
    } while (pageInfo?.nextPage && pagesFetched < maxPages);

    res.json(collected.map(toClientCustomer));
  } catch (err) {
    console.error("/api/customers error", err);
    res.status(500).json({ error: "Failed to load customers" });
  }
});

module.exports = router;
