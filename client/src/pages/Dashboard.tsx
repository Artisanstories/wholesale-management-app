import React from "react";
import {Page, Card, BlockStack, Button, Text, InlineGrid} from "@shopify/polaris";

const Dashboard: React.FC = () => {
  const [status, setStatus] = React.useState("Waiting…");

  const onCheck = async () => {
    try {
      const r = await fetch("/api/me", {credentials: "include"});
      const j = await r.json();
      setStatus(j?.message ?? "OK");
    } catch (e: any) {
      setStatus(e?.message ?? "Failed");
    }
  };

  return (
    <Page title="Wholesale Dashboard" subtitle="Embedded">
      <BlockStack gap="400">
        <InlineGrid columns={{xs: 1, md: 3}} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="p" tone="subdued">Install status</Text>
              <Text as="p" variant="bodyMd" tone="success">{status}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" tone="subdued">Scopes</Text>
              <Text as="p" variant="bodyMd">
                read_products, write_products, read_customers, write_customers
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="p" tone="subdued">Actions</Text>
              <Button onClick={onCheck}>Check API</Button>
            </BlockStack>
          </Card>
        </InlineGrid>
      </BlockStack>
    </Page>
  );
};

export default Dashboard;
