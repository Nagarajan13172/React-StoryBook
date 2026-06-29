// platform/__tests__/phase3-generators.test.mjs
// ---------------------------------------------------------------------------
// Tests for the Phase-3 generators (MSW mocks, visual/responsive spec). They
// take the whole scan `analysis`, so we feed synthetic analyses and assert the
// emitted scaffolds are correct — without touching the real repo.
//   run:  node --test platform/__tests__/
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateMswMocks } from '../generators/msw-mock.mjs';
import { generateVisualSpec } from '../generators/visual-responsive.mjs';

/** Create a throwaway project with one API source file; returns {root, rel, cleanup}. */
function fixtureApi(relPath, source) {
  const root = mkdtempSync(path.join(tmpdir(), 'ftap-'));
  const abs = path.join(root, relPath);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, source);
  return { root, rel: relPath, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

// --- MSW mock generator -----------------------------------------------------
test('msw: skips when no application API files were detected', () => {
  assert.equal(generateMswMocks({ root: '/x', api: [] }).skipped !== undefined, true);
});

test('msw: emits handlers/server + a per-API integration test, marker-guarded', () => {
  // api[].file points at a source file the generator reads; use this repo's real one.
  const analysis = { root: process.cwd(), api: [{ file: 'src/api/useUsers.ts', methods: [] }] };
  const { files, skipped } = generateMswMocks(analysis);
  assert.equal(skipped, undefined, 'should not skip when an endpoint is found');
  const paths = files.map((f) => f.filename.replace(/\\/g, '/'));
  assert.ok(paths.includes('src/test/msw/handlers.ts'));
  assert.ok(paths.includes('src/test/msw/server.ts'));
  assert.ok(paths.some((p) => p.endsWith('useUsers.api.test.ts')));
  // The detected endpoint (/api/users, from fetch('/api/users')) shows up as a handler.
  const handlers = files.find((f) => f.filename.endsWith('handlers.ts')).content;
  assert.match(handlers, /http\.get\('\/api\/users'/);
  // Every emitted file carries the generated marker so --force is safe.
  for (const f of files) assert.match(f.content, /@generated|auto-generated/);
});

test('msw: excludes MSW infrastructure files (no mock-for-the-mock)', () => {
  const analysis = { root: process.cwd(), api: [{ file: 'src/test/msw/handlers.ts', methods: [] }] };
  assert.match(generateMswMocks(analysis).skipped ?? '', /no application API/);
});

test('msw: template-literal URL ${id} becomes an MSW :id param (not a literal)', () => {
  const fx = fixtureApi('src/api/orders.ts', 'export const get = (id) => fetch(`/api/orders/${id}`);');
  try {
    const { files } = generateMswMocks({ root: fx.root, api: [{ file: fx.rel, methods: [] }] });
    const handlers = files.find((f) => f.filename.endsWith('handlers.ts')).content;
    assert.match(handlers, /http\.get\('\/api\/orders\/:id'/);
    assert.doesNotMatch(handlers, /\$\{/, 'no raw interpolation left in the path');
  } finally {
    fx.cleanup();
  }
});

test('msw: server import is relative to the API file depth (works when nested)', () => {
  const fx = fixtureApi('src/features/users/api/useUsers.ts', "export const f = () => fetch('/api/users');");
  try {
    const { files } = generateMswMocks({ root: fx.root, api: [{ file: fx.rel, methods: [] }] });
    const apiTest = files.find((f) => f.filename.endsWith('.api.test.ts')).content;
    assert.match(apiTest, /from '\.\.\/\.\.\/\.\.\/test\/msw\/server'/);
    assert.match(apiTest, /it\.todo\(/, 'error path is a pending TODO, not a vacuous green test');
  } finally {
    fx.cleanup();
  }
});

// --- visual generator hardening --------------------------------------------
test('visual: parametrized :param routes are substituted, not navigated literally', () => {
  const { content } = generateVisualSpec({ root: '/x', routes: [{ paths: ['/users/:id'] }] });
  assert.match(content, /path: '\/users\/1'/);
  assert.doesNotMatch(content, /:id/);
});

test('visual: colliding route slugs are disambiguated to unique baselines', () => {
  const { content } = generateVisualSpec({ root: '/x', routes: [{ paths: ['/users/1', '/users-1'] }] });
  assert.match(content, /slug: 'users-1'/);
  assert.match(content, /slug: 'users-1-1'/);
});

test('visual: disables animations for deterministic screenshots', () => {
  const { content } = generateVisualSpec({ root: '/x', routes: [] });
  assert.match(content, /animations: 'disabled'/);
});

// --- visual / responsive generator -----------------------------------------
test('visual: emits a 3-viewport spec for the app root by default', () => {
  const { filename, content } = generateVisualSpec({ root: '/x', routes: [] });
  assert.equal(filename, 'e2e/visual.spec.ts');
  assert.match(content, /toHaveScreenshot/);
  assert.match(content, /mobile/);
  assert.match(content, /tablet/);
  assert.match(content, /desktop/);
  assert.match(content, /@visual/, 'tags tests so functional e2e can exclude them');
  assert.match(content, /'\/',/, "defaults to the '/' page");
});

test('visual: screenshots each discovered route when routes exist', () => {
  const analysis = { root: '/x', routes: [{ paths: ['/users', '/settings'] }] };
  const { content } = generateVisualSpec(analysis);
  assert.match(content, /'\/users',/);
  assert.match(content, /'\/settings',/);
});
