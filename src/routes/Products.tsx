import { Card } from '../components/Card';
import { DataTable } from '../components/DataTable';
import { PRODUCT_COLUMNS, PRODUCTS } from '../data/products';

/** Products page — a sortable, filterable, paginated data table. */
export function Products() {
  return (
    <main className="app__main">
      <Card title="Products" description="Sortable, filterable, paginated table.">
        <DataTable caption="Product catalog" columns={PRODUCT_COLUMNS} rows={PRODUCTS} pageSize={5} />
      </Card>
    </main>
  );
}
