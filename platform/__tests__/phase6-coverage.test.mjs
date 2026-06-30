// platform/__tests__/phase6-coverage.test.mjs
// ---------------------------------------------------------------------------
// Phase-6 scanner detection: per-component role/security/memoization signals,
// the project-level auth surface, and the new auth/table/perf/security/routing
// gaps — plus the two false-positive fixes (state gap only when untested; hooks
// tested by a hook-named test file). Helper functions are unit-tested directly;
// gap derivation is tested end-to-end through scan() on throwaway fixtures.
//   run:  node --test platform/__tests__/
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  scan,
  detectSecurity,
  classifyRole,
  isMemoized,
  rendersLocalListOf,
  rendersUnmemoizedLocalList,
} from '../core/scan.mjs';

// --- detectSecurity ---------------------------------------------------------
test('detectSecurity flags dangerouslySetInnerHTML', () => {
  const kinds = detectSecurity('return <div dangerouslySetInnerHTML={{ __html: x }} />;').map((f) => f.kind);
  assert.deepEqual(kinds, ['dangerousHtml']);
});

test('detectSecurity flags target=_blank without noopener, but not when rel is set', () => {
  assert.equal(detectSecurity('<a target="_blank" href={u}>x</a>')[0].kind, 'unsafeBlank');
  assert.equal(detectSecurity('<a target="_blank" rel="noopener noreferrer" href={u}>x</a>').length, 0);
});

test('detectSecurity flags eval and tokens written to web storage', () => {
  assert.equal(detectSecurity('eval(userInput)')[0].kind, 'eval');
  assert.equal(detectSecurity('localStorage.setItem("authToken", t)')[0].kind, 'tokenStorage');
});

test('detectSecurity ignores sinks that appear only in comments', () => {
  assert.equal(detectSecurity('// never use dangerouslySetInnerHTML here\nreturn <p>{x}</p>;').length, 0);
  assert.equal(detectSecurity('/* target="_blank" is unsafe */ return <a href={u}>x</a>;').length, 0);
});

// --- classifyRole / isMemoized / rendersLocalListOf -------------------------
test('classifyRole identifies table / loginForm / authGuard / list / generic', () => {
  assert.equal(classifyRole('DataGrid', 'return <div/>;'), 'table');
  assert.equal(classifyRole('Foo', '<table><tbody/></table>'), 'table');
  assert.equal(classifyRole('LoginForm', '<form><input type="password"/></form>'), 'loginForm');
  assert.equal(classifyRole('ProtectedRoute', 'return <Outlet/>;'), 'authGuard');
  assert.equal(classifyRole('Listy', 'function Row(){return null} items.map((i) => <Row key={i}/>)'), 'list');
  assert.equal(classifyRole('Plain', 'return <div/>;'), 'generic');
});

test('isMemoized detects memo / useMemo / useCallback', () => {
  assert.equal(isMemoized('export const X = memo(function X(){ return null; });'), true);
  assert.equal(isMemoized('const v = useMemo(() => 1, []);'), true);
  assert.equal(isMemoized('return <div/>;'), false);
});

test('rendersLocalListOf is true for a locally-defined row, false for imported children', () => {
  assert.equal(rendersLocalListOf('function Row(){return null}\narr.map((x) => <Row key={x}/>)'), true);
  assert.equal(rendersLocalListOf('import { NavLink } from "x";\nitems.map((i) => <NavLink key={i}/>)'), false);
  assert.equal(rendersLocalListOf('return <div/>;'), false);
});

// --- scan() integration -----------------------------------------------------
/** Write a map of {relPath: content} into a throwaway project; return {root, cleanup}. */
function makeProject(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'ftap6-'));
  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'fx', dependencies: { react: '19.0.0', 'react-router-dom': '7.0.0' } })
  );
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
const gapAreas = (a) => a.gaps.map((g) => g.area);

test('security: an unsafe sink raises a security gap; a safe component does not', () => {
  const unsafe = makeProject({
    'src/Raw.tsx': 'export function Raw({ html }: { html: string }) { return <div dangerouslySetInnerHTML={{ __html: html }} />; }',
  });
  try {
    const a = scan(unsafe.root);
    assert.ok(gapAreas(a).includes('security'));
    assert.equal(a.components.find((c) => c.name === 'Raw').security[0].kind, 'dangerousHtml');
  } finally {
    unsafe.cleanup();
  }

  const safe = makeProject({
    'src/Safe.tsx': 'export function Safe({ text }: { text: string }) { return <p>{text}</p>; }',
  });
  try {
    assert.ok(!gapAreas(scan(safe.root)).includes('security'));
  } finally {
    safe.cleanup();
  }
});

test('auth: an untested auth surface raises an auth gap; an auth test clears it', () => {
  const authFiles = {
    'src/auth/AuthContext.tsx':
      'import { createContext } from "react";\nconst C = createContext(null);\nexport function AuthProvider({ children }) { return <C.Provider value={null}>{children}</C.Provider>; }\nexport function useAuth() { return { login() {}, logout() {} }; }',
    'src/auth/ProtectedRoute.tsx':
      'import { Navigate } from "react-router-dom";\nexport function ProtectedRoute({ children }) { const user = null; return user ? children : <Navigate to="/login" />; }',
  };
  const noTest = makeProject(authFiles);
  try {
    const a = scan(noTest.root);
    assert.ok(a.auth && a.auth.guard && a.auth.hook, 'auth surface detected');
    assert.equal(a.auth.tested, false);
    assert.ok(gapAreas(a).includes('auth'));
  } finally {
    noTest.cleanup();
  }

  const withTest = makeProject({
    ...authFiles,
    'src/auth/useAuth.test.tsx': 'import { useAuth } from "./AuthContext";\nit("logs in", () => { useAuth().login(); });',
  });
  try {
    const a = scan(withTest.root);
    assert.equal(a.auth.tested, true);
    assert.ok(!gapAreas(a).includes('auth'));
  } finally {
    withTest.cleanup();
  }
});

test('table: a data table without a test raises a table gap; a sibling test clears it', () => {
  const table = 'export function Grid() { return <table><tbody><tr><td>x</td></tr></tbody></table>; }';
  const noTest = makeProject({ 'src/Grid.tsx': table });
  try {
    assert.ok(gapAreas(scan(noTest.root)).includes('table'));
  } finally {
    noTest.cleanup();
  }
  const withTest = makeProject({ 'src/Grid.tsx': table, 'src/Grid.test.tsx': 'it("works", () => {});' });
  try {
    assert.ok(!gapAreas(scan(withTest.root)).includes('table'));
  } finally {
    withTest.cleanup();
  }
});

test('perf: an unmemoized local list raises a perf gap; memoizing clears it', () => {
  const list = (memo) =>
    `${memo ? 'import { memo } from "react";\n' : ''}${memo ? 'const Row = memo(function Row(){ return <li/>; });' : 'function Row(){ return <li/>; }'}\nexport function Feed({ items }: { items: number[] }) { return <ul>{items.map((i) => <Row key={i} />)}</ul>; }`;
  const unmemo = makeProject({ 'src/Feed.tsx': list(false) });
  try {
    assert.ok(gapAreas(scan(unmemo.root)).includes('perf'));
  } finally {
    unmemo.cleanup();
  }
  const memo = makeProject({ 'src/Feed.tsx': list(true) });
  try {
    assert.ok(!gapAreas(scan(memo.root)).includes('perf'));
  } finally {
    memo.cleanup();
  }
});

test('routing: a route set without a catch-all raises a low routing gap', () => {
  const withCatch = makeProject({
    'src/router.tsx': 'import { createBrowserRouter } from "react-router-dom";\nexport const router = createBrowserRouter([{ path: "/" }, { path: "*" }]);',
    'src/router.test.tsx': 'import { createMemoryRouter } from "react-router-dom";\nit("routes", () => { createMemoryRouter([]); });',
  });
  try {
    assert.ok(!gapAreas(scan(withCatch.root)).includes('routing'));
  } finally {
    withCatch.cleanup();
  }
  const noCatch = makeProject({
    'src/router.tsx': 'import { createBrowserRouter } from "react-router-dom";\nexport const router = createBrowserRouter([{ path: "/" }, { path: "about" }]);',
    'src/router.test.tsx': 'import { createMemoryRouter } from "react-router-dom";\nit("routes", () => { createMemoryRouter([]); });',
  });
  try {
    const a = scan(noCatch.root);
    assert.ok(a.gaps.some((g) => g.area === 'routing' && g.severity === 'low'));
  } finally {
    noCatch.cleanup();
  }
});

test('false-positive fixes: state gap only when untested; hook tested by hook-named file', () => {
  // A context store with a test that imports it → no state gap; hook tested via useStore.test.tsx.
  const tested = makeProject({
    'src/store.ts': 'import { createContext } from "react";\nexport const Ctx = createContext<unknown>(null);\nexport function useStore() { return null; }',
    'src/useStore.test.tsx': 'import { useStore } from "./store";\nit("works", () => { useStore(); });',
  });
  try {
    const a = scan(tested.root);
    assert.ok(!gapAreas(a).includes('state'), 'tested store does not gap');
    assert.equal(a.hooks.find((h) => h.name === 'useStore').hasTest, true);
    assert.ok(!gapAreas(a).includes('hooks'));
  } finally {
    tested.cleanup();
  }
});

// --- review regression tests (fixes from the adversarial pass) --------------

test('detectSecurity: a safe link elsewhere does not mask a genuinely unsafe _blank (windowed)', () => {
  const src = '<a target="_blank" rel="noopener noreferrer" href="/a">safe</a>\n' + 'x'.repeat(400) + '\n<a target="_blank" href={u}>unsafe</a>';
  assert.equal(detectSecurity(src)[0].kind, 'unsafeBlank');
  // Object form with rel sitting right next to target (e.g. ExternalLink) stays safe.
  assert.equal(detectSecurity("const p = { target: '_blank', rel: 'noopener noreferrer' };").length, 0);
});

test('classifyRole: a bare *Grid layout is not a table, and login copy is not a login form', () => {
  assert.equal(classifyRole('PhotoGrid', 'return <div className="grid"/>;'), 'generic');
  assert.equal(classifyRole('LoginBanner', 'return <p>Forgot your password?</p>;'), 'generic');
  // A real password input is still a login form.
  assert.equal(classifyRole('LoginPanel', '<input type="password"/>'), 'loginForm');
});

test('rendersUnmemoizedLocalList: row-level memo check, tolerant of parens in arrow params', () => {
  const memoized = 'import { memo } from "react";\nconst Row = memo(function Row(){ return <li/>; });\nx.map((i) => <Row key={i}/>)';
  const plain = 'function Row(){ return <li/>; }\nx.map((i) => <Row key={i}/>)';
  assert.equal(rendersUnmemoizedLocalList(memoized), false);
  assert.equal(rendersUnmemoizedLocalList(plain), true);
  // An unrelated useCallback must NOT mask an unmemoized row (the #4 fix).
  const withCallback = 'function Row(){ return <li/>; }\nconst onClick = useCallback(() => {}, []);\nx.map((i) => <Row key={i}/>)';
  assert.equal(rendersUnmemoizedLocalList(withCallback), true);
  assert.equal(isMemoized(withCallback), true); // informational flag still true
  // Parens in the arrow parameter list don't break detection (the #5 fix).
  assert.equal(rendersLocalListOf('function Row(){ return <li/>; }\nx.map((i = make()) => <Row key={i}/>)'), true);
});

test('moduleHasTest: a hyphen/prefixed import does not falsely mark a store tested', () => {
  // store.ts is untested; a test importing the unrelated `../hooks/use-store` must NOT clear it.
  const fx = makeProject({
    'src/store.ts': 'import { createContext } from "react";\nexport const Ctx = createContext<unknown>(null);',
    'src/other.test.tsx': 'import { useStore } from "../hooks/use-store";\nit("x", () => {});',
  });
  try {
    assert.ok(gapAreas(scan(fx.root)).includes('state'), 'unrelated import does not clear the state gap');
  } finally {
    fx.cleanup();
  }
});

test('table gap clears once the generator-named <Name>.table.test.tsx sibling exists', () => {
  const grid = 'export function Grid() { return <table><tbody/></table>; }';
  const scaffolded = makeProject({ 'src/Grid.tsx': grid, 'src/Grid.table.test.tsx': 'it("todo", () => {});' });
  try {
    assert.ok(!gapAreas(scan(scaffolded.root)).includes('table'), 'Grid.table.test.tsx clears the table gap');
  } finally {
    scaffolded.cleanup();
  }
});

test('api gap does not double-fire: API calls + no MSW yields a single high api gap', () => {
  const fx = makeProject({ 'src/data.ts': 'export const load = () => fetch("/api/x");' });
  try {
    const apiGaps = scan(fx.root).gaps.filter((g) => g.area === 'api');
    assert.equal(apiGaps.length, 1);
    assert.equal(apiGaps[0].severity, 'high');
  } finally {
    fx.cleanup();
  }
});
