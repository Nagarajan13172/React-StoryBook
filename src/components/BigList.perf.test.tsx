import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BigList, rowRenders } from './BigList';
import type { BigListItem } from './BigList';

const items: BigListItem[] = Array.from({ length: 1000 }, (_, i) => ({
  id: i,
  label: `Item #${i + 1}`,
}));

beforeEach(() => {
  rowRenders.count = 0;
});

describe('BigList performance characteristics', () => {
  it('renders only one page of rows regardless of data size (DOM budget)', () => {
    render(<BigList items={items} pageSize={25} />);
    // 1000 items in, at most `pageSize` <li> nodes in the DOM.
    expect(screen.getAllByRole('listitem')).toHaveLength(25);
  });

  it('does not re-render memoized rows when unrelated parent state changes', async () => {
    const user = userEvent.setup();
    render(<BigList items={items} pageSize={25} />);
    // Initial mount renders exactly one page of rows.
    expect(rowRenders.count).toBe(25);

    // Toggling the highlight re-renders the container but the memoized rows
    // receive identical props, so React skips re-rendering them.
    await user.click(screen.getByRole('button', { name: /toggle highlight/i }));
    expect(rowRenders.count).toBe(25);
  });

  it('renders the next page of rows on demand', async () => {
    const user = userEvent.setup();
    render(<BigList items={items} pageSize={25} />);
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Item #26')).toBeInTheDocument();
    expect(screen.getByText(/page 2 of 40/i)).toBeInTheDocument();
  });
});
