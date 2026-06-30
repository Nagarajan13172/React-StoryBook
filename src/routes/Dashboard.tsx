import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { DataTable } from '../components/DataTable';
import { BigList } from '../components/BigList';
import type { BigListItem } from '../components/BigList';
import { useAuth } from '../auth/AuthContext';
import { PRODUCT_COLUMNS, PRODUCTS } from '../data/products';
import './Dashboard.css';

const currency = (n: number) => `$${n.toLocaleString()}`;

// Derived headline metrics (computed from the shared product data).
const totalStock = PRODUCTS.reduce((sum, p) => sum + p.stock, 0);
const avgPrice = Math.round(PRODUCTS.reduce((sum, p) => sum + p.price, 0) / PRODUCTS.length);
const categories = new Set(PRODUCTS.map((p) => p.category)).size;

const STATS: { label: string; value: string }[] = [
  { label: 'Products', value: String(PRODUCTS.length) },
  { label: 'Units in stock', value: totalStock.toLocaleString() },
  { label: 'Avg. price', value: currency(avgPrice) },
  { label: 'Categories', value: String(categories) },
];

// Synthetic "recent activity" feed — exercises the perf-sensitive BigList.
const ACTIVITY: BigListItem[] = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  label: `Order #${1042 - i} — ${PRODUCTS[i % PRODUCTS.length].name}`,
}));

/**
 * Protected dashboard. Reachable only through <ProtectedRoute>, so it can assume
 * a signed-in user. Composes the workshop's components into a realistic authed
 * view: headline stats, the products data-table, and a recent-activity list.
 */
export function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <main className="dash">
      <header className="dash__header">
        <div>
          <h1 className="dash__title">Dashboard</h1>
          <p className="dash__welcome">
            Welcome back, <strong>{user?.name ?? 'guest'}</strong>.{' '}
            <span className="dash__guard">This page is behind the auth guard.</span>
          </p>
        </div>
        <Button variant="secondary" onClick={logout}>
          Sign out
        </Button>
      </header>

      <section className="dash__stats" aria-label="Summary statistics">
        {STATS.map((s) => (
          <div className="dash__stat" key={s.label}>
            <span className="dash__stat-value">{s.value}</span>
            <span className="dash__stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      <div className="dash__grid">
        <Card title="Products" description="Sortable, filterable, paginated.">
          <DataTable caption="Product catalog" columns={PRODUCT_COLUMNS} rows={PRODUCTS} pageSize={5} />
        </Card>
        <Card title="Recent activity" description="Latest orders across the store.">
          <BigList items={ACTIVITY} pageSize={8} />
        </Card>
      </div>
    </main>
  );
}
