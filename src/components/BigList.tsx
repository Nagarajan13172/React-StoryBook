import { memo, useState } from 'react';
import './BigList.css';

export interface BigListItem {
  id: number;
  label: string;
}

export interface BigListProps {
  /** The full item set. Only one page is ever rendered, so this can be large. */
  items: BigListItem[];
  /** Items rendered per page — bounds the DOM size regardless of `items.length`. */
  pageSize?: number;
}

/**
 * Test seam: a memoized `Row` increments this counter on each real (re)render.
 * The perf test resets it and asserts that unrelated parent state changes do NOT
 * re-render rows — i.e. that `memo` is doing its job. Exported so the assertion
 * can observe render behaviour that is otherwise invisible from the DOM.
 */
export const rowRenders = { count: 0 };

const Row = memo(function Row({ item }: { item: BigListItem }) {
  rowRenders.count += 1;
  return <li className="ws-biglist__item">{item.label}</li>;
});

/**
 * A performance-sensitive list. Two properties make it cheap to render and are
 * the things worth testing:
 *  - **DOM budget:** it paginates, so at most `pageSize` rows exist in the DOM
 *    even for very large `items`.
 *  - **Memoized rows:** unrelated parent state (the highlight toggle) re-renders
 *    the container but not the memoized rows.
 */
export function BigList({ items, pageSize = 50 }: BigListProps) {
  const [page, setPage] = useState(0);
  const [highlight, setHighlight] = useState(false);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const visible = items.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize);

  return (
    <section className={`ws-biglist${highlight ? ' ws-biglist--highlight' : ''}`}>
      <div className="ws-biglist__bar">
        <button type="button" onClick={() => setHighlight((h) => !h)}>
          Toggle highlight
        </button>
        <span className="ws-biglist__total">{items.length} items</span>
      </div>
      {/* tabIndex makes the scrollable region keyboard-accessible (a11y). */}
      <ul className="ws-biglist__list" tabIndex={0} aria-label="Items">
        {visible.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </ul>
      <div className="ws-biglist__pager">
        <button
          type="button"
          onClick={() => setPage(Math.max(0, clampedPage - 1))}
          disabled={clampedPage === 0}
        >
          Previous
        </button>
        <span className="ws-biglist__page-status">
          Page {clampedPage + 1} of {pageCount}
        </span>
        <button
          type="button"
          onClick={() => setPage(Math.min(pageCount - 1, clampedPage + 1))}
          disabled={clampedPage >= pageCount - 1}
        >
          Next
        </button>
      </div>
    </section>
  );
}
