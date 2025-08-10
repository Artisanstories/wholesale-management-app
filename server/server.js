// server/server.js
require("@shopify/shopify-api/adapters/node"); // runtime adapter MUST be first

const express = require("express");
const path = require("path");
const { shopify } = require("./shopify-config"); // you will create/update this file
const customersRoute = require("./routes/customers");

const app = express();

// Middleware for JSON
app.use(express.json());

// ✅ API route for customers
app.use("/api/customers", customersRoute);

// ✅ Serve frontend build (React from /web/dist)
app.use(express.static(path.join(__dirname, "..", "web", "dist")));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "web", "dist", "index.html"));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
