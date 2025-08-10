import {
  Card,
  Page,
  Text,
  Button,
  Box,
  DataTable,
  InlineStack,
  Checkbox,
  TextField,
} from "@shopify/polaris";
import { useEffect, useState } from "react";

export default function App() {
  // Demo bits
  const [count, setCount] = useState(0);

  // Preview table
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [showVat, setShowVat] = useState(false);
  const [currency, setCurrency] = useState("GBP");
  const [discount, setDiscount] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  // Settings
  const [discountInput, setDiscountInput] = useState<string>("");
  const [vatInput, setVatInput] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      const d = typeof data.discountPercent === "number" ? data.discountPercent : 20;
      const v = typeof data.vatPercent === "number" ? data.vatPercent : 20;
      setDiscountInput(String(d));
      setVatInput(String(v));
      setDiscount(d); // show in header
    } catch (e) {
      console.error("Failed to load settings", e);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setSaveNote(null);
    try {
      const d = parseFloat(discountInput);
      const v = parseFloat(vatInput);
      if (!Number.isFinite(d) || d < 0 || d > 100) {
        alert("Discount must be between 0 and 100.");
        return;
      }
      if (!Number.isFinite(v) || v < 0 || v > 100) {
        alert("VAT must be between 0 and 100.");
        return;
      }
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountPercent: d, vatPercent: v }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setDiscount(data.discountPercent);
      setSaveNote("Saved!");
      // Optionally refresh preview
      if (rows.length) await loadWholesalePreview();
    } catch (e) {
      console.error(e);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveNote(null), 2500);
    }
  }

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
      const res = await fetch(`/api/wholesale/preview?limit=50`);
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
    // Re-fetch to recompute with/without VAT using server values
    loadWholesalePreview();
  }

  function exportCsv() {
    const url = `/api/wholesale/export.csv?limit=100&showVat=${showVat ? 1 : 0}`;
    window.open(url, "_blank");
  }

  return (
    <Page title="Wholesale Dashboard">
      <Box padding="400" className="space-y-6">
        {/* Demo card */}
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

        {/* Settings card */}
        <Card roundedAbove="sm">
          <Box padding="400" className="space-y-4">
            <Text as="h2" variant="headingLg">
              Settings
            </Text>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <TextField
                label="Wholesale discount (%)"
                type="number"
                value={discountInput}
                onChange={(v) => setDiscountInput(v)}
                autoComplete="off"
                suffix="%"
                min={0}
                max={100}
              />
              <TextField
                label="VAT rate (%)"
                type="number"
                value={vatInput}
                onChange={(v) => setVatInput(v)}
                autoComplete="off"
                suffix="%"
                min={0}
                max={100}
              />
              <div className="flex items-end">
                <Button onClick={saveSettings} loading={saving}>
                  Save
                </Button>
                {saveNote && (
                  <span className="ml-3 text-xs text-gray-500">{saveNote}</span>
                )}
              </div>
            </div>
            <Text tone="subdued" as="p" variant="bodySm">
              These values are saved per shop in your database and used by the
              preview and exports.
            </Text>
          </Box>
        </Card>

        {/* Preview card */}
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
