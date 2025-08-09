import { Card, Page, Text, Button, Box } from "@shopify/polaris";
import { useState } from "react";

export default function App() {
  const [count, setCount] = useState(0);

  async function checkProducts() {
    const res = await fetch("/api/products/count");
    const data = await res.json();
    alert(JSON.stringify(data, null, 2));
  }

  return (
    <Page title="Wholesale Dashboard">
      <Box padding="400">
        <Card roundedAbove="sm">
          <Box padding="400" className="space-y-4">
            <Text as="h2" variant="headingLg">Welcome 👋</Text>
            <p className="text-sm">
              Tailwind + Polaris are working. Try the protected endpoint:
            </p>
            <div className="flex gap-2">
              <Button onClick={checkProducts}>Get product count</Button>
              <Button tone="success" onClick={() => setCount(c => c + 1)}>
                Local state: {count}
              </Button>
            </div>
          </Box>
        </Card>
      </Box>
    </Page>
  );
}
