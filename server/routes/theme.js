const express = require("express");
const router = express.Router();
const { shopify } = require("../shopify-config");

async function injectWholesaleSnippet(session) {
  const admin = new shopify.api.clients.Rest({ session });

  // 1. Create snippet
  await admin.put({
    path: `assets`,
    data: {
      asset: {
        key: "snippets/wholesale-pricing.liquid",
        value: `{% comment %} wholesale pricing snippet {% endcomment %} ...` // <-- full snippet code here
      }
    },
    type: "application/json"
  });

  // 2. Get main theme ID
  const themesResp = await admin.get({ path: "themes" });
  const mainTheme = themesResp.body.themes.find(t => t.role === "main");
  if (!mainTheme) throw new Error("Main theme not found");

  // 3. Get theme.liquid
  const themeLiquidResp = await admin.get({
    path: `themes/${mainTheme.id}/assets`,
    query: { "asset[key]": "layout/theme.liquid" }
  });
  let themeContent = themeLiquidResp.body.asset.value;

  // 4. Inject snippet if not already there
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

// Route to run injection after install
router.post("/inject-theme", async (req, res) => {
  try {
    const session = await shopify.config.sessionStorage.loadSession(
      res.locals.shopify.session.id
    );
    await injectWholesaleSnippet(session);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Theme injection failed" });
  }
});

module.exports = router;
