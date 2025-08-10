require("@shopify/shopify-api/adapters/node");

const express = require("express");
const path = require("path");

const customersRoute = require("./routes/customers");
const themeRouter = require("./routes/theme.js").default || require("./routes/theme.js");
const webhookRouter = require("./routes/webhooks.js").default || require("./routes/webhooks.js");
const authRouter = require("./auth.js").default || require("./auth.js");

const app = express();
app.use(express.json());

// Routes
app.use("/api", authRouter);              // /api/auth + /api/auth/callback
app.use("/api/customers", customersRoute);
app.use("/api/theme", themeRouter);
app.use("/api/webhooks", webhookRouter);

// Serve React build
app.use(express.static(path.join(__dirname, "..", "web", "dist")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "web", "dist", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on :${PORT}`));
