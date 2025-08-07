import React from "react";
import { Card, Text, BlockStack, Badge } from "@shopify/polaris";

interface HomeProps {
  apiKey: string;
}

export default function Home({ apiKey }: HomeProps) {
  const scopes = [
    "read_products",
    "write_products",
    "read_customers",
    "write_customers",
  ];

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingLg">
          App Status
        </Text>

        <Text as="p">
          This is your Shopify Wholesale App dashboard. You can expand this area
          to show quick stats, links to features, or onboarding steps.
        </Text>

        <BlockStack gap="200">
          <Text as="h3" variant="headingMd">
            Scopes
          </Text>
          <BlockStack inlineAlign="start" gap="100">
            {scopes.map((scope) => (
              <Badge key={scope} tone="info">
                {scope}
              </Badge>
            ))}
          </BlockStack>
        </BlockStack>

        <BlockStack gap="200">
          <Text as="h3" variant="headingMd">
            API Key (injected from server)
          </Text>
          <Text as="code" tone="subdued">
            {apiKey || "(missing)"}
          </Text>
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
