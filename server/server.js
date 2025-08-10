// server/server.js
require("@shopify/shopify-api/adapters/node"); // MUST be first

const express = require("express");
const path = require("path");
const { shopify } = require("./shopify-config");
const customersRoute = require("./routes/customers");

const app = express();
app.use(express.json());

// API
app.use("/api/customers", customersRoute);

// Serve React build
app.use(express.static(path.join(__dirname, "..", "web", "dist")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "web", "dist", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on :${PORT}`));
