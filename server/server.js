// server/server.js
require("@shopify/shopify-api/adapters/node"); // MUST be first

const express = require("express");
const path = require("path");
const { shopify } = require("./shopify-config");

const customersRoute = require("./routes/customers");
const themeRouter = require("./routes/theme.js").default || require("./routes/theme.js");
const webhookRouter = require("./routes/webhooks.js").default || require("./routes/webhooks.js");

const app = express();
app.use(express.json());

// API Routes
app.use("/api/customers", customersRoute);
app.use("/api/theme", themeRouter);       // Theme injection/testing
app.use("/api/webhooks", webhookRouter);  // Webhooks (uninstall cleanup)

// Serve React build
app.use(express.static(path.join(__dirname, "..", "web", "dist")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "web", "dist", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on :${PORT}`));
