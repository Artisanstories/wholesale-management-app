import { shopify } from "./shopify-config.js";

export default async function addScriptTag(session) {
  const client = new shopify.api.rest.RestClient(session.shop, session.accessToken);
  await client.post({
    path: "script_tags",
    data: {
      script_tag: {
        event: "onload",
        src: `${process.env.APP_URL}/wholesale-pricing.js`,
      },
    },
    type: shopify.api.rest.DataType.JSON,
  });
}