// platform/generators/table.mjs
// ---------------------------------------------------------------------------
// Emits <Name>.table.test.tsx for components the scanner classifies as a data
// table (renders <table> or named *Table/*Grid). Scaffolds the behaviours a
// table owes a test: accessible semantics, sorting, filtering, pagination, and
// an empty state. The developer supplies sample columns/rows.
//
//   generateTableTest(component) -> { filename, content } | { skipped }
// ---------------------------------------------------------------------------
import { GENERATED_MARKER } from '../../scripts/lib/stories.mjs';
import { classifyRole } from '../core/scan.mjs';

export function generateTableTest(component) {
  const { name, exportType, source } = component;
  if (classifyRole(name, source) !== 'table') return { skipped: `<${name}/> is not a data table` };

  const importLine =
    exportType === 'default' ? `import ${name} from './${name}';` : `import { ${name} } from './${name}';`;

  const content = `// ${GENERATED_MARKER} — data-table test scaffold for <${name}/>.
// Provide sample columns/rows, then turn each it.todo() into an assertion.
// You'll typically want:
//   import { render, screen, within } from '@testing-library/react';
//   import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
${importLine}

describe('${name} (data table)', () => {
  it('is importable', () => {
    expect(${name}).toBeDefined();
  });

  it.todo('renders accessible table semantics (caption, columnheader, rows)');
  it.todo('sorts by a column and toggles aria-sort ascending/descending');
  it.todo('filters rows by query and reports the result count');
  it.todo('paginates and disables prev/next at the ends');
  it.todo('shows an empty state when no rows match');

  // Example:
  //   render(<${name} caption="…" columns={[…]} rows={[…]} />);
  //   const header = screen.getByRole('columnheader', { name: /…/i });
  //   await userEvent.click(within(header).getByRole('button'));
  //   expect(header).toHaveAttribute('aria-sort', 'ascending');
});
`;

  return { filename: `${name}.table.test.tsx`, content };
}
