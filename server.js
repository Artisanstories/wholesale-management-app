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

app.get("/inject-script", async (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send("Missing shop parameter");

  try {
    await addScriptTag(shop);
    res.send("Script tag added successfully");
  } catch (err) {
    console.error("Script injection failed:", err);
    res.status(500).send("Failed to inject script");
  }
});

app.get("/api/me", (req, res) => {
  res.send({ success: true, message: "Shopify wholesale app running ✅" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
