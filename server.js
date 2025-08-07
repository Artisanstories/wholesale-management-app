// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { shopify } from "./shopify-config.js";
import applyAuthMiddleware from "./auth.js";
import addScriptTag from "./script-injector.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

applyAuthMiddleware(app);

// Health check
app.get("/api/me", (req, res) => {
  res.send({ success: true, message: "Shopify wholesale app running ✅" });
});

// Optional: manual script injection endpoint (requires a fresh session from /auth/callback flow)
app.post("/api/inject-script", async (req, res) => {
  try {
    // In a real app you'd look up the session from storage.
    // For now, this endpoint is a placeholder to avoid confusion.
    return res
      .status(501)
      .send("Script injection endpoint not wired to a session yet.");
  } catch (err) {
    console.error("Script injection failed:", err);
    res.status(500).send("Failed to inject script");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
