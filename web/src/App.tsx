import {
  Card,
  Page,
  Text,
  Button,
  Box,
  DataTable,
  InlineStack,
  Checkbox,
} from "@shopify/polaris";
import { useState } from "react";

export default function App() {
  const [count, setCount] = useState(0);
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [showVat, setShowVat] = useState(false);
  const [currency, setCurrency] = useState("GBP");
  const [discount, setDiscount] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  async function checkProducts() {
    const res = await fetch("/api/products/count");
    const data = await res.json();
    alert(JSON.stringify(data, null, 2));
  }

  function fmt(n: number, curr: string) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: curr,
      }).format(n);
    } catch {
      return `${curr} ${n.toFixed(2)}`;
    }
  }

  async function loadWholesalePreview() {
    setLoading(true);
    try {
      const res = await fetch("/api/wholesale/preview?limit=50");
      const data = await res.json();

      setCurrency(data.currency || "GBP");
      setDiscount(
        typeof data.discountPercent === "number" ? data.discountPercent : null
      );
      setTotal(Array.isArray(data.items) ? data.items.length : 0);

      const table = (data.items || []).map((i: any) => {
        const retail = showVat ? i.retailIncVat : i.retail;
        const wholesale = showVat ? i.wholesaleIncVat : i.wholesale;
        return [
          i.productTitle,
          i.variantTitle || "-",
          fmt(retail, data.currency || "GBP"),
          fmt(wholesale, data.currency || "GBP"),
        ];
      });

      setRows(table);
    } catch (e) {
      alert("Failed to load wholesale preview");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function toggleVat(checked: boolean) {
    setShowVat(checked);
    // Re-fetch to recompute with/without VAT
    loadWholesalePreview();
  }

  function exportCsv() {
    const url = `/api/wholesale/export.csv?limit=100&showVat=${showVat ? 1 : 0}`;
    window.open(url, "_blank"); // triggers download
  }

  return (
    <Page title="Wholesale Dashboard">
      <Box padding="400" className="space-y-6">
        <Card roundedAbove="sm">
          <Box padding="400" className="space-y-4">
            <Text as="h2" variant="headingLg">
              Welcome 👋
            </Text>
            <p className="text-sm">
              Tailwind + Polaris are working. Try the protected endpoint:
            </p>
            <div className="flex gap-2">
              <Button onClick={checkProducts}>Get product count</Button>
              <Button tone="success" onClick={() => setCount((c) => c + 1)}>
                Local state: {count}
              </Button>
            </div>
          </Box>
        </Card>

        <Card roundedAbove="sm">
          <Box padding="400" className="space-y-3">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingLg">
                Wholesale price preview
              </Text>
              <InlineStack gap="400" blockAlign="center">
                {discount !== null && (
                  <Text as="span" variant="bodySm" tone="subdued">
                    Discount: {discount}% • Currency: {currency}
                    {total !== null ? ` • Rows: ${total}` : ""}
                  </Text>
                )}
                <Checkbox
                  label="Show VAT"
                  checked={showVat}
                  onChange={(checked) => toggleVat(checked)}
                />
                <Button loading={loading} onClick={loadWholesalePreview}>
                  {loading ? "Loading…" : "Load preview"}
                </Button>
                <Button variant="secondary" onClick={exportCsv}>
                  Export CSV
                </Button>
              </InlineStack>
            </InlineStack>

            <DataTable
              columnContentTypes={["text", "text", "numeric", "numeric"]}
              headings={[
                "Product",
                "Variant",
                `Retail (${currency})`,
                `Wholesale (${currency})`,
              ]}
              rows={rows}
              stickyHeader
            />
          </Box>
        </Card>
      </Box>
    </Page>
  );
}
