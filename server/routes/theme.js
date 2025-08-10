// server/routes/theme.js
const express = require("express");
const { shopify } = require("../shopify-config");

const router = express.Router();

/**
 * Inject the wholesale snippet into the main theme.
 * @param {import('@shopify/shopify-api').Session} session
 */
async function injectWholesaleSnippet(session) {
  const admin = new shopify.api.clients.Rest({ session });

  const snippetCode = `
{% comment %}
  Wholesale Pricing Snippet
  - Hides prices for guests
  - Exposes discount & VAT flags for wholesale customers
{% endcomment %}
{% if customer %}
  {% assign discount = 0 %}
  {% if customer.tags contains 'wholesale-uk' %}
    {% assign discount = 40 %}
  {% elsif customer.tags contains 'wholesale-us' %}
    {% assign discount = 35 %}
  {% endif %}
  <script>
    window.WHOLESALE_DISCOUNT = {{ discount }};
    window.VAT_INCLUDED = {{ shop.metafields.wholesale.vat_toggle | default: false }};
  </script>
{% else %}
  <style>
    .price, .product-price, .product-form__submit { display: none !important; }
  </style>
  <div style="padding: 1rem; text-align: center;">
    <a href="/account/login" class="button">Login to view wholesale pricing</a>
  </div>
{% endif %}
`;

  // Upload snippet
  await admin.put({
    path: "assets",
    data: { asset: { key: "snippets/wholesale-pricing.liquid", value: snippetCode } },
    type: "application/json",
  });

  // Find main theme
  const themesResp = await admin.get({ path: "themes" });
  const mainTheme = themesResp.body.themes.find((t) => t.role === "main");
  if (!mainTheme) throw new Error("Main theme not found");

  // Load theme.liquid
  const themeLiquidResp = await admin.get({
    path: `themes/${mainTheme.id}/assets`,
    query: { "asset[key]": "layout/theme.liquid" },
  });
  let themeContent = themeLiquidResp.body.asset.value || "";

  // Inject include before </body>
  if (!themeContent.includes("{% include 'wholesale-pricing' %}")) {
    themeContent = themeContent.replace(
      "</body>",
      "{% include 'wholesale-pricing' %}\n</body>"
    );
    await admin.put({
      path: `themes/${mainTheme.id}/assets`,
      data: { asset: { key: "layout/theme.liquid", value: themeContent } },
      type: "application/json",
    });
  }

  console.log(`✅ Wholesale snippet injected for ${session.shop}`);
}

// Optional: manual trigger for testing
router.post("/inject", async (req, res) => {
  try {
    // If you set res.locals.shopify.session earlier, use that.
    // Otherwise load from your storage (omitted here for brevity).
    res.status(501).json({ error: "Bind session loading for manual inject if needed." });
  } catch (err) {
    console.error("Theme injection failed:", err);
    res.status(500).json({ error: "Theme injection failed" });
  }
});

module.exports = { router, injectWholesaleSnippet };
