// script-injector.js
import { shopify } from "./shopify-config.js";

export default async function addScriptTag(shop) {
  const sessions = await shopify.sessionStorage.findSessionsByShop(shop);
  const session = sessions?.[0];

  if (!session) {
    throw new Error(`No session found for shop ${shop}`);
  }

  const client = new shopify.clients.Rest({ session });

  await client.post({
    path: "script_tags",
    data: {
      script_tag: {
        event: "onload",
        src: "https://example.com/your-script.js", // Replace with your real script
      },
    },
    type: shopify.types.DataType.JSON,
  });

  console.log(`Script tag injected for ${shop}`);
}
