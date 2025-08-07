// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { shopify } from "./shopify-config.js";
import applyAuthMiddleware from "./auth.js";

dotenv.config();
const app = express();

// 👇 IMPORTANT: behind Render's proxy so cookies get Secure/SameSite=None
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// OAuth routes
applyAuthMiddleware(app);

// Health check
app.get("/api/me", (req, res) => {
  res.send({ success: true, message: "Shopify wholesale app running ✅" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[startup] Server running on port ${PORT}`);
});
