import React from "react";
import ReactDOM from "react-dom/client";
import "@shopify/polaris/build/esm/styles.css";
import "./app.css";

import App from "./App";

import { AppProvider } from "@shopify/polaris";
import en from "@shopify/polaris/locales/en.json";

// Set the frontend API endpoint that App.tsx will call for customers
// You can change this later if your API path differs.
;(window as any).CUSTOMER_API = "/api/customers";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProvider i18n={en}>
      <App />
    </AppProvider>
  </React.StrictMode>
);
