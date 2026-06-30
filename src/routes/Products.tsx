import { Card } from '../components/Card';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';

interface Product extends Record<string, unknown> {
  name: string;
  category: string;
  price: number;
  stock: number;
}

const COLUMNS: Column<Product>[] = [
  { key: 'name', header: 'Name' },
  { key: 'category', header: 'Category' },
  { key: 'price', header: 'Price' },
  { key: 'stock', header: 'In stock' },
];

const PRODUCTS: Product[] = [
  { name: 'Aluminum Mug', category: 'Kitchen', price: 18, stock: 120 },
  { name: 'Bamboo Cutting Board', category: 'Kitchen', price: 32, stock: 64 },
  { name: 'Canvas Tote', category: 'Bags', price: 24, stock: 200 },
  { name: 'Desk Lamp', category: 'Office', price: 45, stock: 31 },
  { name: 'Ergonomic Chair', category: 'Office', price: 240, stock: 12 },
  { name: 'Felt Coasters', category: 'Home', price: 12, stock: 310 },
  { name: 'Glass Carafe', category: 'Kitchen', price: 28, stock: 78 },
  { name: 'Hardcover Notebook', category: 'Office', price: 16, stock: 410 },
  { name: 'Insulated Bottle', category: 'Outdoors', price: 35, stock: 150 },
  { name: 'Jute Rug', category: 'Home', price: 120, stock: 22 },
  { name: 'Knit Throw', category: 'Home', price: 60, stock: 40 },
  { name: 'Linen Apron', category: 'Kitchen', price: 38, stock: 56 },
];

/** Products page — a sortable, filterable, paginated data table. */
export function Products() {
  return (
    <main className="app__main">
      <Card title="Products" description="Sortable, filterable, paginated table.">
        <DataTable caption="Product catalog" columns={COLUMNS} rows={PRODUCTS} pageSize={5} />
      </Card>
    </main>
  );
}
