import React from "react";
import {
  AppProvider,
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Button
} from "@shopify/polaris";
import TopNav from "./components/TopNav";
import Home from "./components/Home";

declare global {
  interface Window {
    __APP_CONFIG__?: { SHOP: string; API_KEY: string };
  }
}

export default function App() {
  const shop = window.__APP_CONFIG__?.SHOP || "";
  const apiKey = window.__APP_CONFIG__?.API_KEY || "";

  return (
    <AppProvider i18n={{}}>
      <TopNav />
      <Page title="Wholesale Dashboard" subtitle="embedded">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="p">Shop: {shop || "(unknown)"}</Text>
                <BlockStack inlineAlign="start" gap="200">
                  <Button url={`/api/me`} target="_blank">Check API</Button>
                  <Button
                    url={`https://${shop}/admin`}
                    target="_blank"
                    variant="secondary"
                  >
                    Open Shopify Admin
                  </Button>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Home apiKey={apiKey} />
          </Layout.Section>
        </Layout>
      </Page>
    </AppProvider>
  );
}
