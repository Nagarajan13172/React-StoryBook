import { useId, useMemo, useState } from 'react';
import './DataTable.css';

export interface Column<T> {
  /** Key of the row field this column displays. */
  key: keyof T & string;
  /** Visible column header text. */
  header: string;
}

export interface DataTableProps<T extends Record<string, unknown>> {
  /** Column definitions, in display order. */
  columns: Column<T>[];
  /** The full row set (the table paginates/sorts/filters this in memory). */
  rows: T[];
  /** Rows per page. Defaults to 10. */
  pageSize?: number;
  /** Accessible table caption. */
  caption: string;
}

type SortDir = 'ascending' | 'descending';

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
}

/**
 * Accessible, dependency-free data table with client-side sorting, filtering,
 * and pagination plus an empty state.
 *
 * a11y: real <table> semantics, `<th scope="col">` headers that are buttons to
 * sort, `aria-sort` on the active column, a labelled filter input, and a
 * `role="status"` live region announcing the result count.
 */
export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  pageSize = 10,
  caption,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<(keyof T & string) | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('ascending');
  const [page, setPage] = useState(0);
  const filterId = useId();

  // Derive the visible rows once per relevant change (filter → sort), memoized
  // so re-renders from unrelated state don't repeat the work.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? rows.filter((row) =>
          columns.some((col) => String(row[col.key] ?? '').toLowerCase().includes(q))
        )
      : rows;
    if (!sortKey) return matched;
    const sorted = [...matched].sort((a, b) => compare(a[sortKey], b[sortKey]));
    return sortDir === 'descending' ? sorted.reverse() : sorted;
  }, [rows, columns, query, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize);

  function toggleSort(key: keyof T & string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'ascending' ? 'descending' : 'ascending'));
    } else {
      setSortKey(key);
      setSortDir('ascending');
    }
    setPage(0);
  }

  return (
    <div className="ws-table">
      <div className="ws-table__toolbar">
        <label className="ws-table__filter-label" htmlFor={filterId}>
          Filter
        </label>
        <input
          id={filterId}
          className="ws-table__filter"
          type="search"
          value={query}
          placeholder="Filter rows…"
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <span className="ws-table__count" role="status">
          {filtered.length} result{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      <table className="ws-table__grid">
        <caption className="ws-table__caption">{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => {
              const active = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? sortDir : 'none'}
                  className="ws-table__th"
                >
                  <button
                    type="button"
                    className="ws-table__sort"
                    onClick={() => toggleSort(col.key)}
                  >
                    {col.header}
                    <span aria-hidden="true" className="ws-table__arrow">
                      {active ? (sortDir === 'ascending' ? ' ▲' : ' ▼') : ''}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {pageRows.length === 0 ? (
            <tr>
              <td className="ws-table__empty" colSpan={columns.length}>
                No matching rows.
              </td>
            </tr>
          ) : (
            pageRows.map((row, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.key} className="ws-table__td">
                    {String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="ws-table__pager">
        <button
          type="button"
          className="ws-table__page-btn"
          onClick={() => setPage(Math.max(0, clampedPage - 1))}
          disabled={clampedPage === 0}
        >
          Previous
        </button>
        <span className="ws-table__page-status">
          Page {clampedPage + 1} of {pageCount}
        </span>
        <button
          type="button"
          className="ws-table__page-btn"
          onClick={() => setPage(Math.min(pageCount - 1, clampedPage + 1))}
          disabled={clampedPage >= pageCount - 1}
        >
          Next
        </button>
      </div>
    </div>
  );
}
