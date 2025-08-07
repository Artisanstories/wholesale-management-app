import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import shopify from "./shopify-config.js";
import { applyAuthMiddleware } from "./auth.js"; // <-- FIXED
import addScriptTag from "./script-injector.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

applyAuthMiddleware(app);

app.get("/api/me", async (req, res) => {
  res.send({ success: true, message: "Shopify wholesale app running ✅" });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server started on port", process.env.PORT || 3000);
});
