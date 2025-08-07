// script-injector.js
import { shopify } from "./shopify-config.js";

// NOTE: This requires you've completed OAuth and have a session stored.
// With shopifyApi v7 + in-memory storage, we don't persist across restarts.
// We'll keep this util, but call it only after auth and in the same process.
export default async function addScriptTag(session) {
  if (!session) throw new Error("Missing session");

  const client = new shopify.clients.Rest({ session });

  await client.post({
    path: "script_tags",
    data: {
      script_tag: {
        event: "onload",
        src: "https://example.com/your-script.js" // TODO: change to your script
      },
    },
    type: shopify.types.DataType.JSON,
  });

  console.log(`Script tag injected for ${session.shop}`);
}
