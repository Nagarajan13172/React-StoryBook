// platform/__tests__/phase6-generators.test.mjs
// ---------------------------------------------------------------------------
// Phase-6 generators (routing / auth-flow / table / perf / security). They take
// either the scan `analysis` (project-level) or a component descriptor
// (component-level) and emit a marker-guarded test scaffold — or skip when the
// shape doesn't apply. We assert the emitted content + skip behaviour without
// touching the real repo.
//   run:  node --test platform/__tests__/
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRoutingTest } from '../generators/routing.mjs';
import { generateAuthFlowTest } from '../generators/auth-flow.mjs';
import { generateTableTest } from '../generators/table.mjs';
import { generatePerfTest } from '../generators/perf.mjs';
import { generateSecurityTest } from '../generators/security.mjs';

const MARKER = /auto-generated|@generated/;

// --- routing ----------------------------------------------------------------
test('routing: scaffolds createMemoryRouter + detected paths + a 404, marker-guarded', () => {
  const { filename, content } = generateRoutingTest({
    routes: [{ paths: ['/', '/products/:id', '*'] }],
    routing: { catchAll: true },
  });
  assert.match(filename, /routing\.scaffold\.test\.tsx$/);
  assert.match(content, MARKER);
  assert.match(content, /createMemoryRouter/);
  assert.match(content, /renders the route at \/products\/1/); // :id substituted
  assert.match(content, /404/);
});

test('routing: skips when no routes are detected', () => {
  assert.match(generateRoutingTest({ routes: [] }).skipped, /no routes/);
});

// --- auth-flow --------------------------------------------------------------
test('auth-flow: scaffolds the three flows and references the detected modules', () => {
  const { filename, content } = generateAuthFlowTest({
    auth: { provider: 'src/auth/AuthContext.tsx', guard: 'src/auth/ProtectedRoute.tsx', hook: null, loginForm: null },
  });
  assert.match(filename, /auth\.flow\.scaffold\.test\.tsx$/);
  assert.match(content, MARKER);
  assert.match(content, /AuthContext/);
  assert.match(content, /redirects a guarded route/);
  assert.match(content, /rejects invalid credentials/);
});

test('auth-flow: skips when there is no auth surface', () => {
  assert.match(generateAuthFlowTest({ auth: null }).skipped, /no auth/);
});

// --- table ------------------------------------------------------------------
test('table: emits a sort/filter/pagination scaffold for a data table', () => {
  const { filename, content } = generateTableTest({
    name: 'Grid',
    exportType: 'named',
    source: 'export function Grid(){ return <table><tbody/></table>; }',
  });
  assert.equal(filename, 'Grid.table.test.tsx');
  assert.match(content, MARKER);
  assert.match(content, /aria-sort/);
  assert.match(content, /columnheader/);
  assert.match(content, /import \{ Grid \} from '\.\/Grid'/);
});

test('table: skips a component that is not a data table', () => {
  assert.match(
    generateTableTest({ name: 'Plain', exportType: 'named', source: 'export function Plain(){ return <div/>; }' }).skipped,
    /not a data table/
  );
});

// --- perf -------------------------------------------------------------------
test('perf: emits a DOM-budget + memoization scaffold for a list component', () => {
  const { filename, content } = generatePerfTest({
    name: 'Feed',
    exportType: 'named',
    source: 'function Row(){ return <li/>; }\nexport function Feed({ items }){ return <ul>{items.map((i) => <Row key={i}/>)}</ul>; }',
  });
  assert.equal(filename, 'Feed.perf.test.tsx');
  assert.match(content, MARKER);
  assert.match(content, /DOM budget/i);
  assert.match(content, /memoized rows/i);
});

test('perf: skips a component that does not render a list', () => {
  assert.match(
    generatePerfTest({ name: 'Plain', exportType: 'named', source: 'export function Plain(){ return <div/>; }' }).skipped,
    /does not render a list/
  );
});

// --- security ---------------------------------------------------------------
test('security: emits one todo per detected sink, naming the component + risk', () => {
  const { filename, content } = generateSecurityTest({
    components: [
      { name: 'Raw', security: [{ kind: 'dangerousHtml', message: 'renders raw HTML' }] },
      { name: 'Safe', security: [] },
    ],
  });
  assert.match(filename, /security\.scaffold\.test\.tsx$/);
  assert.match(content, MARKER);
  assert.match(content, /Raw: dangerousHtml/);
  assert.doesNotMatch(content, /Safe:/);
});

test('security: skips when no sinks were detected', () => {
  assert.match(generateSecurityTest({ components: [{ name: 'Safe', security: [] }] }).skipped, /no security/);
});
