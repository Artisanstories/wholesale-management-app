import React, { useEffect, useMemo, useState } from "react";
import { Search, Filter, ChevronDown, RefreshCcw } from "lucide-react";

export type Customer = {
  id: string;
  name: string;
  email: string;
  company?: string;
  tags: string[];
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, children, ...props }) => (
  <button
    className={cx(
      "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium shadow-sm",
      "bg-black text-white hover:opacity-90 active:opacity-80",
      className
    )}
    {...props}
  >
    {children}
  </button>
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cx(
        "w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none",
        "focus:ring-4 focus:ring-neutral-200",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

const Chip: React.FC<{ selected?: boolean; onClick?: () => void; children: React.ReactNode }>
  = ({ selected, onClick, children }) => (
    <button
      onClick={onClick}
      className={cx(
        "rounded-2xl border px-3 py-1 text-xs",
        selected ? "bg-black text-white border-black" : "bg-white text-black border-neutral-300 hover:bg-neutral-50"
      )}
    >
      {children}
    </button>
  );

function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

async function fetchCustomers(params: { search?: string; statuses?: string[]; tags?: string[] }): Promise<Customer[]> {
  const base = (window as any).CUSTOMER_API as string | undefined;
  const url = new URL(base || "", window.location.origin);
  if (params.search) url.searchParams.set("search", params.search);
  if (params.statuses?.length) url.searchParams.set("status", params.statuses.join(","));
  if (params.tags?.length) url.searchParams.set("tags", params.tags.join(","));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to load customers (${res.status})`);
  return (await res.json()) as Customer[];
}

export default function App() {
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<Array<Customer["status"]>>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Customer[]>([]);

  const debouncedSearch = useDebounced(search, 250);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    data.forEach((c) => c.tags.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCustomers({ search: debouncedSearch, statuses, tags })
      .then((rows) => { if (!cancelled) setData(rows); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedSearch, statuses, tags]);

  const toggleStatus = (s: Customer["status"]) =>
    setStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const clearFilters = () => { setStatuses([]); setTags([]); setSearch(""); };

  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-black" />
              <h1 className="text-lg font-semibold">Wholesale Customers</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={clearFilters} className="bg-white text-black border border-neutral-300">
                <RefreshCcw className="h-4 w-4" /> Reset
              </Button>
              <Button>
                <Filter className="h-4 w-4" /> Filters
              </Button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, company…"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto md:justify-end">
              {(["pending", "approved", "rejected"] as const).map((s) => (
                <Chip key={s} selected={statuses.includes(s)} onClick={() => toggleStatus(s)}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Chip>
              ))}
            </div>
          </div>
          {allTags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-neutral-500">Tags:</span>
              {allTags.map((t) => (
                <Chip key={t} selected={tags.includes(t)} onClick={() => toggleTag(t)}>
                  {t}
                </Chip>
              ))}
              <button className="ml-2 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900" onClick={() => setTags([])}>
                Clear tags <ChevronDown className="h-3 w-3 rotate-90" />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-neutral-200" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center">
            <p className="text-sm text-neutral-600">No customers found. Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.map((c) => (
              <CustomerCard key={c.id} c={c} />)
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function CustomerCard({ c }: { c: Customer }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold leading-tight">{c.name}</h3>
          <p className="mt-0.5 text-xs text-neutral-600">{c.company || "—"}</p>
        </div>
        <span className={cx(
          "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
          c.status === "approved" && "bg-emerald-100 text-emerald-700",
          c.status === "pending" && "bg-amber-100 text-amber-700",
          c.status === "rejected" && "bg-rose-100 text-rose-700",
        )}>{c.status}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.tags.map((t) => (
          <span key={t} className="rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] text-neutral-600">{t}</span>
        ))}
      </div>
      <a href={`mailto:${c.email}`} className="mt-3 inline-block text-xs text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900">
        {c.email}
      </a>
    </div>
  );
}
