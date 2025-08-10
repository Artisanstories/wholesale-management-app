import express from "express";
import { shopify } from "../shopify.js";

const router = express.Router();

/**
 * Removes the wholesale snippet from the theme when the app is uninstalled.
 * @param {Session} session
 */
export async function removeWholesaleSnippet(session) {
  const admin = new shopify.api.clients.Rest({ session });

  try {
    // 1️⃣ Delete the snippet file
    await admin.delete({
      path: "assets",
      query: { "asset[key]": "snippets/wholesale-pricing.liquid" }
    });

    // 2️⃣ Get main theme ID
    const themesResp = await admin.get({ path: "themes" });
    const mainTheme = themesResp.body.themes.find(t => t.role === "main");
    if (!mainTheme) return;

    // 3️⃣ Get theme.liquid content
    const themeLiquidResp = await admin.get({
      path: `themes/${mainTheme.id}/assets`,
      query: { "asset[key]": "layout/theme.liquid" }
    });
    let themeContent = themeLiquidResp.body.asset.value;

    // 4️⃣ Remove include line if present
    if (themeContent.includes("{% include 'wholesale-pricing' %}")) {
      themeContent = themeContent.replace("{% include 'wholesale-pricing' %}", "");

      await admin.put({
        path: `themes/${mainTheme.id}/assets`,
        data: {
          asset: {
            key: "layout/theme.liquid",
            value: themeContent
          }
        },
        type: "application/json"
      });
    }
    console.log(`✅ Wholesale snippet removed for shop ${session.shop}`);
  } catch (err) {
    console.error(`❌ Error removing wholesale snippet for ${session.shop}`, err);
  }
}

// Shopify webhook endpoint
router.post("/uninstalled", async (req, res) => {
  try {
    const shop = req.headers["x-shopify-shop-domain"];
    if (!shop) return res.sendStatus(400);

    // Load offline session for the shop
    const session = await shopify.config.sessionStorage.loadSessionForShop(shop);
    if (!session) {
      console.warn(`⚠ No session found for shop ${shop}, skipping cleanup`);
      return res.sendStatus(200);
    }

    await removeWholesaleSnippet(session);
    res.sendStatus(200);
  } catch (err) {
    console.error("Uninstall webhook error:", err);
    res.sendStatus(500);
  }
});

export default router;
