import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  Page,
  Layout,
  TextField,
  Button,
  Badge,
  Spinner,
  EmptyState,
  Stack,
} from "@shopify/polaris";

type Customer = {
  id: string;
  name: string;
  email: string;
  company?: string;
  tags: string[];
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

const statusOptions: { label: string; value: Customer["status"]; color: "warning" | "success" | "critical" }[] = [
  { label: "Pending", value: "pending", color: "warning" },
  { label: "Approved", value: "approved", color: "success" },
  { label: "Rejected", value: "rejected", color: "critical" },
];

export default function App() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeStatuses, setActiveStatuses] = useState<Customer["status"][]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = (window as any).CUSTOMER_API || "/api/customers";

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (activeStatuses.length) params.set("status", activeStatuses.join(","));
      if (activeTags.length) params.set("tags", activeTags.join(","));

      const res = await fetch(`${apiUrl}?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Customer[] = await res.json();
      setCustomers(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, search, activeStatuses, activeTags]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const toggleStatus = (status: Customer["status"]) => {
    setActiveStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const resetFilters = () => {
    setSearch("");
    setActiveStatuses([]);
    setActiveTags([]);
  };

  return (
    <Page title="Customer Filter">
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <Stack spacing="tight" wrap>
              <TextField
                label="Search customers"
                labelHidden
                placeholder="Search by name, email, company..."
                value={search}
                onChange={setSearch}
                autoComplete="off"
              />
              <Button onClick={fetchCustomers} primary>Search</Button>
              <Button onClick={resetFilters}>Reset</Button>
            </Stack>
          </Card>

          <Card sectioned>
            <Stack spacing="tight" wrap>
              {statusOptions.map((opt) => (
                <Badge
                  key={opt.value}
                  status={opt.color}
                  onClick={() => toggleStatus(opt.value)}
                  tone={activeStatuses.includes(opt.value) ? "success" : undefined}
                >
                  {opt.label}
                </Badge>
              ))}
            </Stack>
          </Card>

          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <Spinner size="large" />
            </div>
          ) : error ? (
            <Card sectioned>
              <p style={{ color: "red" }}>{error}</p>
            </Card>
          ) : customers.length === 0 ? (
            <EmptyState
              heading="No customers found"
              action={{ content: "Clear filters", onAction: resetFilters }}
              image=""
            >
              <p>Try adjusting your search or filters.</p>
            </EmptyState>
          ) : (
            customers.map((c) => (
              <Card key={c.id} sectioned title={c.name}>
                <p><strong>Email:</strong> {c.email}</p>
                {c.company && <p><strong>Company:</strong> {c.company}</p>}
                <p><strong>Status:</strong> {c.status}</p>
                {c.tags.length > 0 && <p><strong>Tags:</strong> {c.tags.join(", ")}</p>}
              </Card>
            ))
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
