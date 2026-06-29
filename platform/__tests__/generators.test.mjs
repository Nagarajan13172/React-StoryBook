// platform/__tests__/generators.test.mjs
// ---------------------------------------------------------------------------
// Tests for the platform itself (spec step 7). These feed the generators the
// "hard" component shapes the adversarial review surfaced, and assert the
// emitted artifacts stay correct — so the fixes can't silently regress.
//   run:  node --test platform/__tests__/
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProps } from '../../scripts/lib/stories.mjs';
import { exprForProp, extractFlow } from '../generators/lib.mjs';
import { generateUnitTest } from '../generators/vitest-rtl.mjs';
import { generateStatesStory } from '../generators/stories-matrix.mjs';

const comp = (name, source, exportType = 'named') => ({
  name,
  source,
  exportType,
  dir: '/virtual',
  file: `/virtual/${name}.tsx`,
  hasStory: false,
});

// --- parseProps robustness --------------------------------------------------
test('parseProps: multiple members on one line', () => {
  const props = parseProps('interface XProps { a: string; b: number }', 'X');
  assert.deepEqual(props.map((p) => p.name), ['a', 'b']);
});

test('parseProps: members with no trailing semicolons', () => {
  const props = parseProps('interface ZProps {\n  a: string\n  b: number\n}', 'Z');
  assert.equal(props.length, 2);
});

test('parseProps: multi-line union type, keeps optionality', () => {
  const src = 'interface YProps {\n  variant:\n    | "a"\n    | "b";\n  size?: number;\n}';
  const props = parseProps(src, 'Y');
  const variant = props.find((p) => p.name === 'variant');
  const size = props.find((p) => p.name === 'size');
  assert.ok(variant && !variant.optional, 'variant required');
  assert.match(variant.type, /a/);
  assert.ok(size && size.optional, 'size optional');
});

test('parseProps: generic type with a comma is not split', () => {
  const props = parseProps('interface MProps { data: Record<string, number>; n: number }', 'M');
  assert.deepEqual(props.map((p) => p.name), ['data', 'n']);
  assert.match(props[0].type, /Record<string, number>/);
});

// --- exprForProp non-scalar placeholders ------------------------------------
test('exprForProp: arrays -> [], records/objects -> {}, fn -> arrow, unknown -> null as never', () => {
  assert.equal(exprForProp({ name: 'items', type: 'string[]' }, 'C').expr, '[]');
  assert.equal(exprForProp({ name: 'cols', type: 'Array<{ id: string }>' }, 'C').expr, '[]');
  assert.equal(exprForProp({ name: 'map', type: 'Record<string, number>' }, 'C').expr, '{}');
  assert.equal(exprForProp({ name: 'render', type: '(x: number) => ReactNode' }, 'C').expr, '() => undefined');
  assert.equal(exprForProp({ name: 'when', type: 'Date' }, 'C').expr, 'null as never');
});

// --- RTL generator: required handler + icon-only button ---------------------
test('RTL: required handler prop becomes a vi.fn() spy, never an unimported fn()', () => {
  const c = comp('Widget', 'interface WidgetProps { onReady: () => void }\nexport function Widget({ onReady }: WidgetProps) { onReady; return <div />; }');
  const { content } = generateUnitTest(c);
  assert.match(content, /import \{ describe, it, expect, vi \} from 'vitest'/);
  assert.match(content, /const onReady = vi\.fn\(\)/);
  assert.doesNotMatch(content, /\{fn\(\)\}/, 'no bare Storybook fn() spy in JSX');
  assert.doesNotMatch(content, /import \{ fn \}/, 'does not import the Storybook-only fn');
  assert.match(content, /const \{ container \} = render\(/, 'container is destructured when used');
});

test('RTL: icon-only button uses role query, never an undestructured container', () => {
  const c = comp('IconButton', 'import type { ReactNode } from "react";\ninterface IconButtonProps { onClick: () => void; children?: ReactNode }\nexport function IconButton({ onClick, children }: IconButtonProps) { return <button onClick={onClick}>{children}</button>; }');
  const { content } = generateUnitTest(c);
  assert.match(content, /fires onClick when clicked/);
  assert.match(content, /screen\.getByRole\('button'\)/);
  assert.doesNotMatch(content, /click\(container/, 'never clicks container.firstChild');
});

test('RTL: onChange type-test is skipped when value is a REQUIRED prop', () => {
  const c = comp('Field', 'interface FieldProps { label: string; value: string; onChange: (v: string) => void }\nexport function Field({ label, value, onChange }: FieldProps) { return <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />; }');
  const { content } = generateUnitTest(c);
  assert.doesNotMatch(content, /calls onChange as the user types/);
});

// --- state-matrix generator: array-typed required prop ----------------------
test('states story: array-typed required prop is [] not a bogus string', () => {
  const c = comp('List', 'interface ListProps { items: string[]; title?: string }\nexport function List({ items }: ListProps) { return <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>; }');
  const { content } = generateStatesStory(c);
  assert.match(content, /items: \[\]/);
  assert.doesNotMatch(content, /items: 'Items'/);
});

// --- flow extraction --------------------------------------------------------
test('extractFlow: ignores aria-label, picks the real field label', () => {
  const src = '<form aria-label="Survey form"><TextField label="Your name" /><button type="submit">Send</button></form>';
  const { label, submit } = extractFlow(src);
  assert.equal(label, 'Your name');
  assert.equal(submit, 'Send');
});

test('extractFlow: falls back to a native <label> element', () => {
  const src = '<form><label htmlFor="u">Username</label><input id="u" /><button type="submit">Go</button></form>';
  assert.equal(extractFlow(src).label, 'Username');
});
