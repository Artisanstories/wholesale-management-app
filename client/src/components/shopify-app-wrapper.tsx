import React from "react";
import { AppProvider } from "@shopify/app-bridge-react";
import { Provider as PolarisProvider } from "@shopify/polaris";
import translations from "@shopify/polaris/locales/en.json";

export default function ShopifyAppWrapper({ children }) {
  const config = {
    apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
    host: new URLSearchParams(window.location.search).get("host"),
    forceRedirect: true,
  };

  return (
    <AppProvider config={config}>
      <PolarisProvider i18n={translations}>
        {children}
      </PolarisProvider>
    </AppProvider>
  );
}