import pkg from "@shopify/shopify-api";

// Use in-memory session storage for development
class CustomMemoryStorage {
  constructor() {
    this.sessions = new Map();
  }

  async storeSession(session) {
    this.sessions.set(session.id, session);
    return true;
  }

  async loadSession(id) {
    return this.sessions.get(id) || undefined;
  }

  async deleteSession(id) {
    return this.sessions.delete(id);
  }

  async findSessionsByShop(shop) {
    return Array.from(this.sessions.values()).filter(
      (session) => session.shop === shop
    );
  }
}

const { shopifyApi, LATEST_API_VERSION } = pkg;

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SCOPES.split(","),
  hostName: process.env.HOST.replace(/^https?:\/\//, ""),
  isEmbeddedApp: true,
  apiVersion: LATEST_API_VERSION,
  sessionStorage: new CustomMemoryStorage()
});

export { shopify };
