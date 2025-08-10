import express from "express";
import { shopify } from "../shopify.js";

const router = express.Router();

/**
 * Injects the wholesale snippet into the store theme.
 * @param {Session} session - Shopify session object from OAuth.
 */
export async function injectWholesaleSnippet(session) {
  const admin = new shopify.api.clients.Rest({ session });

  // 1️⃣ Create wholesale snippet content
  const snippetCode = `
{% comment %}
  Wholesale Pricing Snippet
  - Hides prices for non-logged-in customers
  - Applies discount for tagged wholesale customers
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
    .price, .product-price, .product-form__submit {
      display: none !important;
    }
  </style>
  <div style="padding: 1rem; text-align: center;">
    <a href="/account/login" class="button">Login to view wholesale pricing</a>
  </div>
{% endif %}
`;

  // 2️⃣ Upload snippet to Shopify
  await admin.put({
    path: `assets`,
    data: {
      asset: {
        key: "snippets/wholesale-pricing.liquid",
        value: snippetCode
      }
    },
    type: "application/json"
  });

  // 3️⃣ Get main theme ID
  const themesResp = await admin.get({ path: "themes" });
  const mainTheme = themesResp.body.themes.find(t => t.role === "main");
  if (!mainTheme) throw new Error("Main theme not found");

  // 4️⃣ Get theme.liquid content
  const themeLiquidResp = await admin.get({
    path: `themes/${mainTheme.id}/assets`,
    query: { "asset[key]": "layout/theme.liquid" }
  });
  let themeContent = themeLiquidResp.body.asset.value;

  // 5️⃣ Inject snippet if not already present
  if (!themeContent.includes("{% include 'wholesale-pricing' %}")) {
    themeContent = themeContent.replace(
      "</body>",
      "{% include 'wholesale-pricing' %}\n</body>"
    );

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
}

/**
 * API endpoint to manually trigger snippet injection (for testing).
 * Example: POST /api/theme/inject
 */
router.post("/inject", async (req, res) => {
  try {
    const session = await shopify.config.sessionStorage.loadSession(
      res.locals.shopify.session.id
    );
    await injectWholesaleSnippet(session);
    res.json({ success: true });
  } catch (err) {
    console.error("Theme injection failed:", err);
    res.status(500).json({ error: "Theme injection failed" });
  }
});

export default router;
