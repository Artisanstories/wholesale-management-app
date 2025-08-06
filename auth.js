import { shopify } from "./shopify-config.js";

export default function applyAuthMiddleware(app) {
  app.get("/auth", async (req, res) => {
    const authRoute = await shopify.auth.begin({
      shop: req.query.shop,
      callbackPath: "/auth/callback",
      isOnline: true,
      rawRequest: req,
      rawResponse: res,
    });
    return res.redirect(authRoute);
  });

  app.get("/auth/callback", async (req, res) => {
    try {
      const session = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      await shopify.webhooks.register({
        session,
      });

      await import("./script-injector.js").then((mod) =>
        mod.default(session)
      );

      const host = req.query.host;
      res.redirect(`/app?shop=${session.shop}&host=${host}`);
    } catch (e) {
      console.error(e);
      res.status(500).send(e.message);
    }
  });
}