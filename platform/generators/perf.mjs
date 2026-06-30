// platform/generators/perf.mjs
// ---------------------------------------------------------------------------
// Emits <Name>.perf.test.tsx for components that render a list of a locally
// defined child component (the classic "unmemoized row" perf shape). Scaffolds
// two deterministic, non-flaky perf assertions: a DOM-node budget (only one page
// of rows in the DOM) and a memoization check (unrelated state doesn't re-render
// rows). Wall-clock timing is intentionally avoided.
//
//   generatePerfTest(component) -> { filename, content } | { skipped }
// ---------------------------------------------------------------------------
import { GENERATED_MARKER } from '../../scripts/lib/stories.mjs';
import { rendersLocalListOf } from '../core/scan.mjs';

export function generatePerfTest(component) {
  const { name, exportType, source } = component;
  if (!rendersLocalListOf(source)) return { skipped: `<${name}/> does not render a list` };

  const importLine =
    exportType === 'default' ? `import ${name} from './${name}';` : `import { ${name} } from './${name}';`;

  const content = `// ${GENERATED_MARKER} — performance test scaffold for <${name}/>.
// Deterministic perf checks (no wall-clock timing):
//   1. DOM budget — only one page of rows is ever in the DOM, even for large data.
//   2. Memoization — unrelated parent state must not re-render memoized rows.
//      (Expose a render counter from your row component to assert this — see
//       src/components/BigList.tsx + BigList.perf.test.tsx for a worked example.)
// You'll typically want:
//   import { render, screen } from '@testing-library/react';
//   import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
${importLine}

describe('${name} (performance)', () => {
  it('is importable', () => {
    expect(${name}).toBeDefined();
  });

  it.todo('renders only one page of rows regardless of data size (DOM budget)');
  it.todo('does not re-render memoized rows when unrelated parent state changes');

  // Example DOM-budget assertion:
  //   render(<${name} items={Array.from({ length: 1000 }, (_, i) => ({ id: i, label: String(i) }))} pageSize={25} />);
  //   expect(screen.getAllByRole('listitem')).toHaveLength(25);
});
`;

  return { filename: `${name}.perf.test.tsx`, content };
}
