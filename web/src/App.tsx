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
  ResourceList,
  ResourceItem,
} from "@shopify/polaris";
import { useEffect, useMemo, useState } from "react";

type Rule = { tag: string; discountPercent: number };
type Customer = { id: string; email: string; name: string; tags: string[] };

export default function App() {
  // Demo
  const [count, setCount] = useState(0);

  // Base settings (saved per shop in DB)
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

  /* ---------------- Settings ---------------- */

  async function loadSettings() {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      const d = typeof data.discountPercent === "number" ? data.discountPercent : 20;
      const v = typeof data.vatPercent === "number" ? data.vatPercent : 20;
      setDiscountInput(String(d));
      setVatInput(String(v));
      setDiscount(d); // shows in preview header
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
      if (!Number.isFinite(d) || d < 0 || d > 100) return alert("Discount must be 0–100.");
      if (!Number.isFinite(v) || v < 0 || v > 100) return alert("VAT must be 0–100.");
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
      setTimeout(() => setSaveNote(null), 2000);
    }
  }

  /* ---------------- Tag rules ---------------- */

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
    if (!Number.isFinite(d) || d < 0 || d > 100) return alert("Discount must be 0–100.");
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
      const res = await fetch(`/api/rules/${encodeURIComponent(tag)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      setRules(data.rules || []);
      if (selectedCustomer) await loadWholesalePreview();
    } catch (e) {
      console.error(e);
      alert("Failed to delete rule");
    }
  }

  /* ---------------- Customers ---------------- */

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

  /* ---------------- Preview ---------------- */

  function fmt(n: number, curr: string) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: curr }).format(n);
    } catch {
      return `${curr} ${n.toFixed(2)}`;
    }
  }

  async function loadWholesalePreview(customerId?: string) {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "50" });
      if (customerId || selectedCustomer?.id) qs.set("customerId", String(customerId || selectedCustomer!.id));
      const res = await fetch(`/api/wholesale/preview?${qs.toString()}`);
      const data = await res.json();

      setCurrency(data.currency || "GBP");
      setDiscount(typeof data.discountPercent === "number" ? data.discountPercent : null);
      setTotal(Array.isArray(data.items) ? data.items.length : 0);

      const table = (data.items || []).map((i: any) => {
        const retail = showVat ? i.retailIncVat : i.retail;
        const wholesale = showVat ? i.wholesaleIncVat : i.wholesale;
        return [i.productTitle, i.variantTitle || "-", fmt(retail, data.currency || "GBP"), fmt(wholesale, data.currency || "GBP")];
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

  function exportCsv() {
    const qs = new URLSearchParams({ limit: "100", showVat: showVat ? "1" : "0" });
    if (selectedCustomer?.id) qs.set("customerId", String(selectedCustomer.id));
    window.open(`/api/wholesale/export.csv?${qs.toString()}`, "_blank");
  }

  const selectedCustomerTags = useMemo(
    () => (selectedCustomer?.tags || []).map((t) => t.trim()).filter(Boolean),
    [selectedCustomer]
  );

  /* ---------------- UI ---------------- */

  return (
    <Page title="Wholesale Dashboard">
      <Box padding="400" className="space-y-6">

        {/* Demo */}
        <Card roundedAbove="sm">
          <Box padding="400" className="space-y-3">
            <Text as="h2" variant="headingLg">Welcome 👋</Text>
            <div className="flex gap-2">
              <Button onClick={async () => {
                const res = await fetch("/api/products/count");
                alert(JSON.stringify(await res.json(), null, 2));
              }}>Get product count</Button>
              <Button tone="success" onClick={() => setCount((c) => c + 1)}>Local state: {count}</Button>
            </div>
          </Box>
        </Card>

        {/* Settings */}
        <Card roundedAbove="sm">
          <Box padding="400" className="space-y-4">
            <Text as="h2" variant="headingLg">Settings</Text>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <TextField label="Base wholesale discount (%)" type="number" value={discountInput} onChange={setDiscountInput} autoComplete="off" suffix="%" min={0} max={100} />
              <TextField label="VAT rate (%)" type="number" value={vatInput} onChange={setVatInput} autoComplete="off" suffix="%" min={0} max={100} />
              <div className="flex items-end gap-3">
                <Button onClick={saveSettings} loading={saving}>Save</Button>
                {saveNote && <span className="text-xs text-gray-500">{saveNote}</span>}
              </div>
            </div>
            <Text tone="subdued" as="p" variant="bodySm">
              Base discount applies to everyone unless a tag rule overrides it for a specific customer.
            </Text>
          </Box>
        </Card>

        {/* Tag Rules */}
        <Card roundedAbove="sm">
          <Box padding="400" className="space-y-4">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingLg">Tag rules</Text>
              <Text tone="subdued" as="span" variant="bodySm">Highest matching tag discount wins.</Text>
            </InlineStack>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <TextField label="Customer tag" value={newRuleTag} onChange={setNewRuleTag} autoComplete="off" placeholder="e.g. wholesale-vip" />
              <TextField label="Discount (%)" type="number" value={newRuleDiscount} onChange={setNewRuleDiscount} autoComplete="off" suffix="%" min={0} max={100} />
              <div className="flex items-end">
                <Button onClick={addRule}>Add / Update Rule</Button>
              </div>
            </div>

            <Divider />

            <ResourceList
              resourceName={{ singular: "rule", plural: "rules" }}
              items={rules}
              renderItem={(item) => {
                const { tag, discountPercent } = item;
                return (
                  <ResourceItem id={tag}>
                    <InlineStack align="space-between" blockAlign="center">
                      <div>
                        <Text as="h3" variant="headingSm">{tag}</Text>
                        <Text tone="subdued" as="p" variant="bodySm">Discount: {discountPercent}%</Text>
                      </div>
                      <Button variant="secondary" tone="critical" onClick={() => removeRule(tag)}>Delete</Button>
                    </InlineStack>
                  </ResourceItem>
                );
              }}
            />
          </Box>
        </Card>

        {/* Customer picker */}
        <Card roundedAbove="sm">
          <Box padding="400" className="space-y-4">
            <Text as="h2" variant="headingLg">Preview as customer</Text>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <TextField label="Search customers" value={query} onChange={setQuery} autoComplete="off" placeholder="name or email" />
              <div className="flex items-end">
                <Button onClick={searchCustomers} loading={searching}>Search</Button>
              </div>
            </div>

            {results.length > 0 && (
              <ResourceList
                resourceName={{ singular: "customer", plural: "customers" }}
                items={results}
                renderItem={(c) => (
                  <ResourceItem id={c.id} onClick={() => chooseCustomer(c)}>
                    <InlineStack align="space-between" blockAlign="center">
                      <div>
                        <Text as="h3" variant="headingSm">{c.name || "(no name)"} {c.email ? `(${c.email})` : ""}</Text>
                        {c.tags?.length ? (
                          <Text tone="subdued" variant="bodySm" as="p">Tags: {c.tags.join(", ")}</Text>
                        ) : null}
                      </div>
                      <Button>Use</Button>
                    </InlineStack>
                  </ResourceItem>
                )}
              />
            )}

            {selectedCustomer && (
              <div className="space-y-1">
                <Text as="p" variant="bodyMd">Selected: {selectedCustomer.name} {selectedCustomer.email ? `(${selectedCustomer.email})` : ""}</Text>
                {selectedCustomerTags.length ? (
                  <Text tone="subdued" variant="bodySm" as="p">Tags: {selectedCustomerTags.join(", ")}</Text>
                ) : (
                  <Text tone="subdued" variant="bodySm" as="p">No tags</Text>
                )}
              </div>
            )}
          </Box>
        </Card>

        {/* Preview table */}
        <Card roundedAbove="sm">
          <Box padding="400" className="space-y-3">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingLg">Wholesale price preview</Text>
              <InlineStack gap="400" blockAlign="center">
                {discount !== null && (
                  <Text as="span" variant="bodySm" tone="subdued">
                    Discount: {discount}% • Currency: {currency}
                    {total !== null ? ` • Rows: ${total}` : ""}
                  </Text>
                )}
                <Checkbox label="Show VAT" checked={showVat} onChange={toggleVat} />
                <Button loading={loading} onClick={() => loadWholesalePreview()}>
                  {loading ? "Loading…" : "Load preview"}
                </Button>
                <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
              </InlineStack>
            </InlineStack>

            <DataTable
              columnContentTypes={["text", "text", "numeric", "numeric"]}
              headings={["Product", "Variant", `Retail (${currency})`, `Wholesale (${currency})`]}
              rows={rows}
              stickyHeader
            />
          </Box>
        </Card>

      </Box>
    </Page>
  );
}
