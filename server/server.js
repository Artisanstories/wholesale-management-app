// server/server.js
require("@shopify/shopify-api/adapters/node"); // MUST be first

const express = require("express");
const path = require("path");

const customersRoute = require("./routes/customers");
const theme = require("./routes/theme");
const webhooks = require("./routes/webhooks");
const authRouter = require("./auth");

const app = express();
app.use(express.json());

// Routes
app.use("/api", authRouter);                 // /api/auth & /api/auth/callback
app.use("/api/customers", customersRoute);   // customers list/filter
app.use("/api/theme", theme.router);         // manual inject (optional)
app.use("/api/webhooks", webhooks.router);   // uninstall (best-effort with memory storage)

// Serve React build
app.use(express.static(path.join(__dirname, "..", "web", "dist")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "web", "dist", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on :${PORT}`));
