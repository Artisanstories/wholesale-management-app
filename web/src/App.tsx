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
  Divider,
  Badge,
  ResourceList,
  ResourceItem,
} from "@shopify/polaris";
import { useEffect, useMemo, useState } from "react";

type Rule = { tag: string; discountPercent: number };
type Customer = { id: string; email: string; name: string; tags: string[] };

export default function App() {
  // Demo
  const [count, setCount] = useState(0);

  // Base settings
  const [discountInput, setDiscountInput] = useState<string>("");
  const [vatInput, setVatInput] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  // Tag rules
  const [rules, setRules] = useState<Rule[]>([]);
  const [newRuleTag, setNewRuleTag] = useState("");
  const [newRuleDiscount, setNewRuleDiscount] = useState("");

  // Customer search / selection
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Preview
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [showVat, setShowVat] = useState(false);
  const [currency, setCurrency] = useState("GBP");
  const [discount, setDiscount] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    loadSettings();
    loadRules();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      const d = typeof data.discountPercent === "number" ? data.discountPercent : 20;
      const v = typeof data.vatPercent === "number" ? data.vatPercent : 20;
      setDiscountInput(String(d));
      setVatInput(String(v));
      setDiscount(d);
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
      if (rows.length) await loadWholesalePreview();
    } catch (e) {
      console.error(e);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveNote(null), 2500);
    }
  }

  async function loadRules() {
    try {
      const res = await fetch("/api/rules");
      const data = await res.json();
      setRules(data.rules || []);
    } catch (e) {
      console.error("Failed to load rules", e);
    }
  }

  async function addRule() {
    const tag = newRuleTag.trim().toLowerCase();
    const d = parseFloat(newRuleDiscount);
    if (!tag) return alert("Enter a tag");
    if (!Number.isFinite(d) || d < 0 || d > 100) {
      return alert("Discount must be 0-100");
    }
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, discountPercent: d }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save rule");
      setRules(data.rules || []);
      setNewRuleTag("");
      setNewRuleDiscount("");
      if (selectedCustomer) await loadWholesalePreview();
    } catch (e) {
      console.error(e);
      alert("Failed to save rule");
    }
  }

  async function removeRule(tag: string) {
    if (!confirm(`Delete rule for tag "${tag}"?`)) return;
    try {
      const res = await fetch(`/api/rules/${encodeURIComponent(tag)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      setRules(data.rules || []);
      if (selectedCustomer) await loadWholesalePreview();
    } catch (e) {
      console.error(e);
      alert("Failed to delete rule");
    }
  }

  async function searchCustomers() {
    setSearching(true);
    try {
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.customers || []);
    } catch (e) {
      console.error(e);
      alert("Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function chooseCustomer(c: Customer) {
    setSelectedCustomer(c);
    await loadWholesalePreview(c.id);
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

  async function loadWholesalePreview(customerId?: string) {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "50" });
      if (customerId || selectedCustomer?.id) {
        qs.set("customerId", String(customerId || selectedCustomer?.id));
      }
      const res = await fetch(`/api/wholesale/preview?${qs.toString()}`);
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

      if (data.customer) {
        setSelectedCustomer({
          id: String(data.customer.id),
          email: data.customer.email || "",
          name: data.customer.name || "",
          tags: data.customer.tags || [],
        });
      }

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
    loadWholesalePreview();
  }

  const selectedCustomerTags = useMemo(
    () => (selectedCustomer?.tags || []).map((t) => t.trim()).filter(Boolean),
    [selectedCustomer]
  );

  return (
    <Page title="Wholesale Dashboard">
      <Box padding="400" className="space-y-6">

        {/* Demo */}
        <Card>
          <Box padding="400">
            <Button onClick={checkProducts}>Get product count</Button>
          </Box>
        </Card>

        {/* Settings */}
        {/* ... settings UI code here (unchanged from before) */}

        {/* Tag Rules */}
        {/* ... rules UI code here (unchanged from before) */}

        {/* Customer Filter */}
        <Card>
          <Box padding="400" className="space-y-4">
            <Text as="h2" variant="headingLg">Preview as customer</Text>
            <div className="flex gap-2">
              <TextField
                label="Search customers"
                value={query}
                onChange={setQuery}
                autoComplete="off"
              />
              <Button onClick={searchCustomers} loading={searching}>Search</Button>
            </div>

            {results.length > 0 && (
              <ResourceList
                resourceName={{ singular: "customer", plural: "customers" }}
                items={results}
                renderItem={(item) => (
                  <ResourceItem id={item.id} onClick={() => chooseCustomer(item)}>
                    <Text>{item.name} ({item.email})</Text>
                    {item.tags.length > 0 && (
                      <Text tone="subdued" variant="bodySm">Tags: {item.tags.join(", ")}</Text>
                    )}
                  </ResourceItem>
                )}
              />
            )}

            {selectedCustomer && (
              <div>
                <Text>Selected: {selectedCustomer.name} ({selectedCustomer.email})</Text>
                {selectedCustomerTags.length > 0 && (
                  <Text tone="subdued" variant="bodySm">
                    Tags: {selectedCustomerTags.join(", ")}
                  </Text>
                )}
              </div>
            )}

            <Button onClick={() => loadWholesalePreview()} loading={loading}>
              Load Wholesale Preview
            </Button>

            {rows.length > 0 && (
              <DataTable
                columnContentTypes={["text", "text", "text", "text"]}
                headings={["Product", "Variant", "Retail", "Wholesale"]}
                rows={rows}
              />
            )}
          </Box>
        </Card>

      </Box>
    </Page>
  );
}
