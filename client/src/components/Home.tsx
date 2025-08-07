import React from "react";
import { Card, Text, BlockStack } from "@shopify/polaris";

export default function Home({ apiKey }: { apiKey: string }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingMd">Scopes</Text>
        <Text as="p">read_products, write_products, read_customers, write_customers</Text>
        <Text as="h3" variant="headingMd">API Key (injected)</Text>
        <Text as="code">{apiKey || "(missing)"}</Text>
      </BlockStack>
    </Card>
  );
}
