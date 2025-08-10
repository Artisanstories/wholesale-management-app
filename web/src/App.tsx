// web/src/App.tsx
import { useEffect, useMemo, useState } from 'react';
import { authFetch } from './lib/authFetch';
import '@shopify/polaris/build/esm/styles.css';

type ClientCustomer = {
  id: string;
  name: string;
  email: string;
  company: string;
  tags: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
};

const STATUS_ORDER: Array<ClientCustomer['status']> = ['pending', 'approved', 'rejected'];

export default function App() {
  const [q, setQ] = useState('');
  const [activeStatuses, setActiveStatuses] = useState<Array<ClientCustomer['status']>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ClientCustomer[]>([]);

  const statusParam = useMemo(() => activeStatuses.join(','), [activeStatuses]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/customers', window.location.origin);
      if (q.trim()) url.searchParams.set('search', q.trim());
      if (statusParam) url.searchParams.set('status', statusParam);

      const res = await authFetch(url.toString());
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setItems([]);
        return;
      }
      const data: ClientCustomer[] = await res.json();
      setItems(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // On mount: ensure OAuth session, then load
  useEffect(() => {
    (async () => {
      try {
        await authFetch('/api/ensure-auth', { method: 'GET' });
      } catch {
        // If 401, authFetch will redirect to /api/auth/inline. We don’t need to do anything here.
      }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleStatus(s: ClientCustomer['status']) {
    setActiveStatuses(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]));
  }

  return (
    <div style={{ maxWidth: 900, margin: '24px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>Customer Filter</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          placeholder="Search by name, email, company..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          style={{ flex: 1, padding: '10px 12px', border: '1px solid #dcdcdc', borderRadius: 8 }}
        />
        <button onClick={load} disabled={loading}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #000' }}>
          {loading ? 'Loading…' : 'Search'}
        </button>
        <button
          onClick={() => { setQ(''); setActiveStatuses([]); load(); }}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #dcdcdc' }}>
          Reset
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => toggleStatus(s)}
            style={{
              padding: '6px 10px',
              borderRadius: 16,
              border: '1px solid #ddd',
              background: activeStatuses.includes(s) ? '#e9f5ff' : '#f3f3f3'
            }}
          >
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}

      <div style={{ border: '1px solid #eee', borderRadius: 10 }}>
        {items.length === 0 && !loading && !error && (
          <div style={{ padding: 16, color: '#777' }}>No results yet.</div>
        )}
        {items.map((c) => (
          <div key={c.id} style={{ padding: 12, borderTop: '1px solid #f0f0f0' }}>
            <div style={{ fontWeight: 600 }}>{c.name}</div>
            <div style={{ fontSize: 13, color: '#666' }}>
              {c.email} {c.company ? `• ${c.company}` : ''}
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: '#f5f5f5' }}>
                {c.status}
              </span>
              {c.tags.map((t) => (
                <span key={t} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 12, background: '#fafafa', border: '1px solid #eee' }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
