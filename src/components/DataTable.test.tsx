import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from './DataTable';
import type { Column } from './DataTable';

interface Row extends Record<string, unknown> {
  name: string;
  score: number;
}

const columns: Column<Row>[] = [
  { key: 'name', header: 'Name' },
  { key: 'score', header: 'Score' },
];

const rows: Row[] = [
  { name: 'Charlie', score: 30 },
  { name: 'Alice', score: 10 },
  { name: 'Bob', score: 20 },
];

const names = () =>
  screen
    .getAllByRole('row')
    .slice(1) // drop the header row
    .map((r) => within(r).getAllByRole('cell')[0]?.textContent);

describe('DataTable', () => {
  it('exposes accessible table semantics', () => {
    render(<DataTable<Row> caption="Players" columns={columns} rows={rows} />);
    expect(screen.getByRole('table', { name: /players/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /score/i })).toBeInTheDocument();
  });

  it('sorts by a column and toggles direction via aria-sort', async () => {
    const user = userEvent.setup();
    render(<DataTable<Row> caption="Players" columns={columns} rows={rows} />);
    const header = screen.getByRole('columnheader', { name: /name/i });

    await user.click(within(header).getByRole('button'));
    expect(header).toHaveAttribute('aria-sort', 'ascending');
    expect(names()).toEqual(['Alice', 'Bob', 'Charlie']);

    await user.click(within(header).getByRole('button'));
    expect(header).toHaveAttribute('aria-sort', 'descending');
    expect(names()).toEqual(['Charlie', 'Bob', 'Alice']);
  });

  it('filters rows by query and reports the count', async () => {
    const user = userEvent.setup();
    render(<DataTable<Row> caption="Players" columns={columns} rows={rows} />);
    await user.type(screen.getByLabelText(/filter/i), 'ali');
    expect(names()).toEqual(['Alice']);
    expect(screen.getByRole('status')).toHaveTextContent('1 result');
  });

  it('shows the empty state when nothing matches', async () => {
    const user = userEvent.setup();
    render(<DataTable<Row> caption="Players" columns={columns} rows={rows} />);
    await user.type(screen.getByLabelText(/filter/i), 'zzz');
    expect(screen.getByText(/no matching rows/i)).toBeInTheDocument();
  });

  it('paginates and clamps at the ends', async () => {
    const user = userEvent.setup();
    render(<DataTable<Row> caption="Players" columns={columns} rows={rows} pageSize={2} />);
    expect(names()).toHaveLength(2);
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/page 2 of 2/i)).toBeInTheDocument();
    expect(names()).toHaveLength(1);
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });
});
