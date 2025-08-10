// server/routes/webhooks.js
const express = require("express");
const { shopify } = require("../shopify-config");

const router = express.Router();

/**
 * Remove the wholesale snippet and include from the theme.
 * @param {import('@shopify/shopify-api').Session} session
 */
async function removeWholesaleSnippet(session) {
  const admin = new shopify.api.clients.Rest({ session });

  try {
    // Delete snippet file
    await admin.delete({
      path: "assets",
      query: { "asset[key]": "snippets/wholesale-pricing.liquid" },
    });

    // Main theme
    const themesResp = await admin.get({ path: "themes" });
    const mainTheme = themesResp.body.themes.find((t) => t.role === "main");
    if (!mainTheme) return;

    // Load theme.liquid
    const themeLiquidResp = await admin.get({
      path: `themes/${mainTheme.id}/assets`,
      query: { "asset[key]": "layout/theme.liquid" },
    });
    let themeContent = themeLiquidResp.body.asset.value || "";

    // Remove include
    if (themeContent.includes("{% include 'wholesale-pricing' %}")) {
      themeContent = themeContent.replace("{% include 'wholesale-pricing' %}", "");
      await admin.put({
        path: `themes/${mainTheme.id}/assets`,
        data: { asset: { key: "layout/theme.liquid", value: themeContent } },
        type: "application/json",
      });
    }

    console.log(`✅ Wholesale snippet removed for ${session.shop}`);
  } catch (err) {
    console.error(`❌ Error removing wholesale snippet for ${session.shop}`, err);
  }
}

// Webhook endpoint
router.post("/uninstalled", async (req, res) => {
  try {
    const shop = req.headers["x-shopify-shop-domain"];
    if (!shop) return res.sendStatus(400);

    // Load an offline session for the shop.
    // If you're using MemorySessionStorage, there's not a built-in load by shop;
    // for production you should persist sessions (Redis/DB) and load here.
    console.warn("⚠ Using MemorySessionStorage; cannot load session by shop for uninstall cleanup.");
    return res.sendStatus(200);
  } catch (err) {
    console.error("Uninstall webhook error:", err);
    res.sendStatus(500);
  }
});

module.exports = { router, removeWholesaleSnippet };
