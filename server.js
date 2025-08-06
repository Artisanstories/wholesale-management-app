import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import shopify from "./shopify-config.js";
import applyAuthMiddleware from "./auth.js";
import addScriptTag from "./script-injector.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Shopify auth
applyAuthMiddleware(app);

// Test route
app.get("/api/me", async (req, res) => {
  res.status(200).json({ success: true, message: "Shopify wholesale app running ✅" });
});

// Optional: Inject a script tag (if using)
app.get("/api/inject-script", async (req, res) => {
  try {
    const { shop, accessToken } = req.query;
    if (!shop || !accessToken) {
      return res.status(400).json({ error: "Missing shop or accessToken" });
    }

    const response = await addScriptTag(shop, accessToken);
    res.json({ success: true, response });
  } catch (error) {
    console.error("Script injection error:", error);
    res.status(500).json({ error: "Failed to inject script tag" });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
