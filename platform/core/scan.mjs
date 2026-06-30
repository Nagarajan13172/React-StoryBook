// platform/core/scan.mjs
// ---------------------------------------------------------------------------
// Scanner engine (Platform Feature #1). Inspects a React/Next project and
// returns a structured `analysis` object that every other part of the platform
// (report, generators, dashboard, AI) consumes. Heuristic/regex based for v1 —
// fast, dependency-free; an AST upgrade is a later refinement.
// ---------------------------------------------------------------------------
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { findComponents } from '../../scripts/lib/stories.mjs';
import { analyzeComponent, statesFor } from '../generators/lib.mjs';

// The per-component story states the spec asks every component to cover.
export const REQUIRED_STATES = [
  'Default', 'Loading', 'Disabled', 'Error', 'Empty', 'Dark', 'Mobile', 'Long',
];

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const STORY_RE = /\.stories\.[jt]sx?$/;
const TEST_RE = /\.(test|spec)\.[jt]sx?$/;
// Routing test utilities — their presence in a test/spec file means routing is
// genuinely exercised, so the "no routing tests" gap should not fire.
const ROUTING_TEST_RE = /\b(MemoryRouter|createMemoryRouter|RouterProvider|createRoutesStub|createBrowserRouter)\b/;
// MSW scaffolding lives here; it is the request *mock*, not application API code.
const MSW_INFRA_RE = /[\\/](?:test[\\/]msw|mocks|__mocks__)[\\/]/;

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'build' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

const readSafe = (f) => {
  try {
    return readFileSync(f, 'utf8');
  } catch {
    return '';
  }
};
const pkgVersion = (deps, name) => deps[name]?.replace(/^[\^~]/, '');

// --- framework + stack -----------------------------------------------------
function detectFramework(root, deps) {
  let name = 'unknown';
  if (deps.next) name = 'next';
  else if (deps['@remix-run/react']) name = 'remix';
  else if (deps.vite) name = 'vite';
  else if (deps['react-scripts']) name = 'cra';
  return {
    name,
    react: pkgVersion(deps, 'react') ?? null,
    typescript: existsSync(path.join(root, 'tsconfig.json')) || !!deps.typescript,
    nextAppRouter: existsSync(path.join(root, 'app')) || existsSync(path.join(root, 'src/app')),
  };
}

// `visualWired` adds a stronger signal than the dep alone: an actual Playwright
// visual spec (toHaveScreenshot) means screenshot comparison is really in place.
function detectStack(deps, { browsers = [], visualWired = false } = {}) {
  const has = (n) => !!deps[n];
  return {
    vitest: has('vitest'),
    rtl: has('@testing-library/react'),
    storybookTest: has('@storybook/addon-vitest'),
    msw: has('msw'),
    cucumber: has('@cucumber/cucumber'),
    playwright: has('playwright') || has('@playwright/test'),
    axe: has('axe-core') || has('@axe-core/playwright') || has('@storybook/addon-a11y'),
    // Multi-browser is satisfied once >1 browser is actually configured.
    multiBrowser: browsers.length > 1,
    // Visual regression counts as wired when the Chromatic addon / SB test-runner
    // is installed OR a Playwright visual spec exists in the tree.
    visual: visualWired || has('@chromatic-com/storybook') || has('@storybook/test-runner'),
  };
}

// --- browser matrix + visual-regression signals ----------------------------
// Map a Playwright `devices[...]` / project name to a canonical browser engine.
const BROWSER_ALIASES = [
  [/chrom|chrome|edge|msedge/i, 'chromium'],
  [/firefox|gecko/i, 'firefox'],
  [/webkit|safari/i, 'webkit'],
];
const canonicalBrowser = (s) => BROWSER_ALIASES.find(([re]) => re.test(s))?.[1] ?? s.toLowerCase();

// Strip line + block comments so commented-out `{ name: 'firefox' }` projects
// in playwright.config.ts are NOT counted as configured browsers. The `//`
// guard also spares `:`-prefixed (`https://`) and quote-prefixed
// (`"//cdn.example.com"`) sequences so protocol-relative URL strings survive.
const stripComments = (src = '') =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

/** Read the configured browsers from playwright.config.{ts,js}. */
function playwrightBrowsers(root) {
  const cfg = ['playwright.config.ts', 'playwright.config.js']
    .map((f) => path.join(root, f))
    .find(existsSync);
  if (!cfg) return [];
  const src = stripComments(readSafe(cfg));
  const names = new Set();
  // project `name: 'chromium' | 'firefox' | 'webkit' | 'Mobile Chrome' …`
  for (const m of src.matchAll(/name:\s*['"]([^'"]+)['"]/g)) names.add(canonicalBrowser(m[1]));
  // and any `devices['Desktop Firefox']` reference, which pins an engine
  for (const m of src.matchAll(/devices\[['"]([^'"]+)['"]\]/g)) names.add(canonicalBrowser(m[1]));
  return [...names];
}

/** Read the configured browsers from the vitest browser `instances` in vite/vitest config. */
function viteBrowsers(root) {
  const viteCfg = ['vite.config.ts', 'vite.config.js', 'vitest.config.ts', 'vitest.config.js']
    .map((f) => path.join(root, f))
    .find(existsSync);
  if (!viteCfg) return [];
  const src = stripComments(readSafe(viteCfg));
  return [...new Set([...src.matchAll(/browser:\s*['"](\w+)['"]/g)].map((m) => canonicalBrowser(m[1])))];
}

/** True if any committed spec performs a Playwright screenshot comparison.
 *  Restricted to `toHaveScreenshot` (unambiguously visual) — `toMatchSnapshot`
 *  is also Vitest's serializer-snapshot API, so matching it false-positives. */
function hasVisualSpec(files) {
  return files.some((f) => /\.(spec|test)\.[jt]sx?$/.test(f) && /toHaveScreenshot\s*\(/.test(readSafe(f)));
}

// --- per-component story state matrix --------------------------------------
// Collect story exports across ALL of a component's story files — both the
// hand-written `<Name>.stories.tsx` and any generated `<Name>.states.stories.tsx`.
function storyExports(dir, name) {
  const re = new RegExp(`^${name}(\\.[\\w-]+)?\\.stories\\.(tsx|ts|jsx|js)$`);
  const exports = [];
  let files = [];
  try {
    files = readdirSync(dir);
  } catch {
    return exports;
  }
  for (const f of files) {
    if (!re.test(f)) continue;
    const src = readSafe(path.join(dir, f));
    exports.push(...[...src.matchAll(/export\s+const\s+(\w+)\s*:/g)].map((m) => m[1]));
  }
  return exports;
}

// Coverage is measured against the states a component can ACTUALLY express
// (the same set the generator would emit), not a fixed 8-state list — so a
// Button is never faulted for lacking an Error/Empty state it cannot represent.
function storyStates(model, dir, name) {
  const applicable = statesFor(model).map((s) => s.name);
  const exports = storyExports(dir, name);
  const covered = applicable.filter((state) =>
    exports.some((ex) => ex.toLowerCase().includes(state.toLowerCase()))
  );
  return { applicable, covered, missing: applicable.filter((s) => !covered.includes(s)) };
}

function hasTestFor(dir, name) {
  return ['ts', 'tsx', 'js', 'jsx'].some(
    (e) => existsSync(path.join(dir, `${name}.test.${e}`)) || existsSync(path.join(dir, `${name}.spec.${e}`))
  );
}

// Project-level signal: does any test/spec file drive a router? Routing tests
// rarely colocate with the route file, so we look across all test files.
function hasRoutingTest(files) {
  return files.some((f) => TEST_RE.test(f) && ROUTING_TEST_RE.test(readSafe(f)));
}

// --- Phase 6: auth / table / perf / security signals ------------------------

/** Untrusted-content / unsafe-DOM sinks worth a dedicated security test. */
export function detectSecurity(rawSrc = '') {
  // Strip comments first so a doc-comment *mentioning* a sink (e.g. "we do NOT
  // use dangerouslySetInnerHTML") can't be mistaken for the sink itself.
  const src = stripComments(rawSrc);
  const findings = [];
  if (/dangerouslySetInnerHTML/.test(src)) {
    findings.push({ kind: 'dangerousHtml', message: 'dangerouslySetInnerHTML renders raw HTML — sanitize/escape untrusted input' });
  }
  // target="_blank" (attr or object form) is unsafe unless an accompanying
  // noopener/noreferrer sits NEAR it — checked per-occurrence in a local window,
  // so a safe link elsewhere in the file can't mask a genuinely unsafe one.
  for (const m of src.matchAll(/target\s*[:=]\s*["']_blank["']/g)) {
    const window = src.slice(Math.max(0, m.index - 120), m.index + 120);
    if (!/noopener|noreferrer/.test(window)) {
      findings.push({ kind: 'unsafeBlank', message: 'target="_blank" without rel="noopener noreferrer" (reverse tabnabbing)' });
      break;
    }
  }
  if (/\beval\s*\(/.test(src)) {
    findings.push({ kind: 'eval', message: 'eval() executes arbitrary code' });
  }
  if (/(?:local|session)Storage\.setItem\s*\(\s*['"`][^'"`]*(?:token|jwt|secret|password|auth)/i.test(src)) {
    findings.push({ kind: 'tokenStorage', message: 'auth token written to web storage — exfiltratable via XSS' });
  }
  return findings;
}

/** Classify a component's testing-relevant role from its name + source. */
export function classifyRole(name, rawSrc = '') {
  const src = stripComments(rawSrc);
  // Authoritative signal is an actual <table>; name match is restricted to
  // table-ish suffixes (NOT a bare `Grid`, which is usually a CSS-grid layout).
  if (/<table[\s>]/.test(src) || /(?:DataTable|DataGrid|Table)$/.test(name)) return 'table';
  if (/(?:ProtectedRoute|RequireAuth|AuthGuard)/.test(name) || (/<Navigate\b|\bNavigate\(/.test(src) && /useAuth|isAuthenticated|currentUser/.test(src))) return 'authGuard';
  // Require a real password INPUT (not just the word "password" in copy).
  if (/(?:Login|SignIn)/.test(name) && /type=["']password["']/.test(src)) return 'loginForm';
  if (/<form[\s>]/.test(src) && /type=["']password["']/.test(src)) return 'loginForm';
  if (rendersLocalListOf(src)) return 'list';
  return 'generic';
}

/** True if the component is memoized (or memoizes derived work). Informational. */
export function isMemoized(src = '') {
  return /\bmemo\s*\(|\bReact\.memo\b|\buseMemo\b|\buseCallback\b/.test(stripComments(src));
}

// Find local component names rendered inside a `.map(...)`. `[\s\S]*?=>` (not
// `[^)]*`) tolerates parentheses in the arrow's parameter list (default values
// with calls, destructure defaults). Returns the set of such local names.
function localListRows(src) {
  const locals = new Set();
  for (const m of src.matchAll(/(?:function|const|let|var)\s+([A-Z]\w*)\b/g)) locals.add(m[1]);
  const rendered = new Set();
  for (const m of src.matchAll(/\.map\s*\([\s\S]*?=>[\s\S]*?<([A-Z]\w*)/g)) {
    if (locals.has(m[1])) rendered.add(m[1]);
  }
  return rendered;
}

/**
 * True if the component renders a list of a *locally-defined* component inside a
 * `.map(...)` — ignoring maps over imported nav/link elements.
 */
export function rendersLocalListOf(rawSrc = '') {
  return localListRows(stripComments(rawSrc)).size > 0;
}

/**
 * True if a locally-rendered list row is NOT memoized — the perf anti-pattern.
 * Checks memoization at the ROW level (is `<Row>` wrapped in memo?), not file
 * level, so an unrelated `useCallback`/`useMemo` elsewhere doesn't mask it.
 */
export function rendersUnmemoizedLocalList(rawSrc = '') {
  const src = stripComments(rawSrc);
  const rows = localListRows(src);
  if (!rows.size) return false;
  const memoized = new Set();
  for (const m of src.matchAll(/(?:const|let|var)\s+([A-Z]\w*)\s*=\s*(?:React\.)?memo\s*\(/g)) memoized.add(m[1]);
  for (const row of rows) if (!memoized.has(row)) return true;
  return false;
}

/** Detect the project's auth surface (provider / hook / guard / login form). */
function detectAuth(files) {
  let provider = null;
  let hook = null;
  let guard = null;
  let loginForm = null;
  for (const file of files) {
    if (STORY_RE.test(file) || TEST_RE.test(file) || !CODE_EXT.has(path.extname(file))) continue;
    const src = stripComments(readSafe(file));
    if (!src) continue;
    if (!provider && /\bAuthProvider\b/.test(src) && /createContext/.test(src)) provider = file;
    if (!hook && /export\s+(?:async\s+)?(?:function|const)\s+use(?:Auth|User|Session|CurrentUser)\b/.test(src)) hook = file;
    if (!guard && /export\s+(?:async\s+)?(?:function|const|class)\s+(?:ProtectedRoute|RequireAuth|AuthGuard)\b/.test(src)) guard = file;
    if (!loginForm && /<form[\s>]/.test(src) && /type=["']password["']/.test(src)) loginForm = file;
  }
  if (!(provider || hook || guard || loginForm)) return null;
  return { provider, hook, guard, loginForm };
}

// "Area is tested?" — look across all test files so colocated tests aren't required.
const anyTest = (files, re) => files.some((f) => TEST_RE.test(f) && re.test(readSafe(f)));
const hasAuthTest = (files) => anyTest(files, /useAuth|ProtectedRoute|\blog(?:in|out)\b|sign\s*in|unauthenticated|redirect/i);
const hasCatchAllRoute = (files) =>
  files.some((f) => !TEST_RE.test(f) && CODE_EXT.has(path.extname(f)) && /path:\s*['"`]\*['"`]|path=["']\*["']/.test(readSafe(f)));

/**
 * A module is "tested" if a sibling <base>.test.* exists OR any test file imports
 * the module (covers hooks/stores tested from a differently-named test file).
 */
function moduleHasTest(file, files) {
  const base = path.basename(file).replace(/\.\w+$/, '');
  if (hasTestFor(path.dirname(file), base)) return true;
  // Require `base` to be the FINAL path segment of the import (after an optional
  // `…/`), so `store` doesn't match `from '../hooks/use-store'`.
  const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const importRe = new RegExp(`from\\s+['"\`](?:[^'"\`]*\\/)?${esc}['"\`]`);
  return files.some((f) => TEST_RE.test(f) && importRe.test(readSafe(f)));
}

/** Any sibling test whose name starts with the component (e.g. Foo.test / Foo.table.test). */
function hasSiblingAreaTest(dir, name) {
  let files = [];
  try {
    files = readdirSync(dir);
  } catch {
    return false;
  }
  const re = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\.[\\w-]+)?\\.(test|spec)\\.[jt]sx?$`);
  return files.some((f) => re.test(f));
}

// --- non-component inventory (hooks / routes / api / state) -----------------
function inventory(files) {
  const hooks = [];
  const routes = [];
  const api = [];
  const state = [];

  for (const file of files) {
    if (STORY_RE.test(file) || TEST_RE.test(file)) continue;
    // MSW infrastructure (handlers/server/mocks) mentions "fetch" in prose — it
    // is the mock, not application API code, so never inventory it as an API file.
    if (MSW_INFRA_RE.test(file)) continue;
    if (!CODE_EXT.has(path.extname(file))) continue;
    const src = readSafe(file);
    if (!src) continue;

    // hooks: exported functions/const named use<Something>
    for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(use[A-Z]\w*)/g)) {
      hooks.push({ name: m[1], file });
    }
    // routing
    if (/react-router|createBrowserRouter|<Routes?\b|next\/router|next\/navigation|useRouter/.test(src)) {
      const paths = [...src.matchAll(/path:\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]);
      routes.push({ file, paths });
    }
    // api calls
    const apiHits = (src.match(/\b(fetch|axios|useQuery|useMutation|useSWR)\b/g) || []).length;
    if (apiHits) {
      const methods = [...src.matchAll(/method:\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`]/gi)].map((m) =>
        m[1].toUpperCase()
      );
      api.push({ file, calls: apiHits, methods: [...new Set(methods)] });
    }
    // state management
    if (/\bcreateSlice\b|\bconfigureStore\b/.test(src)) state.push({ kind: 'redux', file });
    else if (/from\s+['"]zustand['"]|\bcreate\s*\(/.test(src) && /zustand/.test(src)) state.push({ kind: 'zustand', file });
    else if (/\bcreateContext\s*</.test(src)) state.push({ kind: 'context', file });
  }
  return { hooks, routes, api, state };
}

// --- gap derivation ---------------------------------------------------------
function deriveGaps(a) {
  const gaps = [];
  const add = (area, severity, message) => gaps.push({ area, severity, message });

  const untested = a.components.filter((c) => !c.hasStory);
  if (untested.length) add('component', 'high', `${untested.length} component(s) have no story/test: ${untested.map((c) => c.name).join(', ')}`);

  const partialStates = a.components.filter((c) => c.hasStory && c.states.missing.length);
  if (partialStates.length) add('component', 'medium', `${partialStates.length} component(s) miss required story states (e.g. ${partialStates[0].name}: ${partialStates[0].states.missing.join(', ')})`);

  const untestedHooks = a.hooks.filter((h) => !h.hasTest);
  if (untestedHooks.length) add('hooks', 'medium', `${untestedHooks.length} hook(s) have no test: ${untestedHooks.map((h) => h.name).join(', ')}`);

  if (a.api.length && !a.stack.msw) add('api', 'high', `API calls found in ${a.api.length} file(s) but MSW is not installed — add request mocking`);
  if (a.routes.length && a.routes.every((r) => !r.tested)) add('routing', 'medium', 'Routes detected but no routing tests found');
  if (a.routes.length && !a.routing?.catchAll) add('routing', 'low', 'No catch-all (404) route detected — add a `path: "*"` route + test');

  // State stores only gap when they are actually untested.
  const untestedState = a.state.filter((s) => !s.tested);
  if (untestedState.length) add('state', 'medium', `State store(s) detected (${[...new Set(untestedState.map((s) => s.kind))].join(', ')}) — add state-management tests`);

  // --- Phase 6 areas: auth / table / perf / security ---
  if (a.auth && !a.auth.tested) {
    add('auth', 'high', 'Auth surface detected (provider/guard/login) but no auth-flow test (login failure + protected redirect)');
  }

  const untestedTables = a.components.filter((c) => c.role === 'table' && !c.hasAreaTest);
  if (untestedTables.length) {
    add('table', 'medium', `Data table(s) without sort/filter/pagination tests: ${untestedTables.map((c) => c.name).join(', ')}`);
  }

  // Perf is source-driven: a list whose ROW component isn't memoized.
  const unmemoizedLists = a.components.filter((c) => c.unmemoizedList);
  if (unmemoizedLists.length) {
    add('perf', 'medium', `Component(s) render an unmemoized list row — wrap the row in React.memo / add a render-perf budget: ${unmemoizedLists.map((c) => c.name).join(', ')}`);
  }

  const risky = a.components.filter((c) => c.security?.length);
  if (risky.length) {
    const first = risky[0];
    add('security', 'high', `Security sink(s) in ${risky.map((c) => c.name).join(', ')} (e.g. ${first.name}: ${first.security[0].kind}) — add a security test`);
  }

  // Only the generic advisory here; when API calls exist the actionable high
  // gap above already covers it (avoid a duplicate `api` gap).
  if (!a.stack.msw && !a.api.length) add('api', 'low', 'MSW not set up (API mocking)');
  if (!a.stack.cucumber) add('bdd', 'low', 'Cucumber.js not set up (BDD scenarios)');
  if (!a.stack.rtl) add('component', 'low', 'React Testing Library not installed (node-side unit tests)');
  if (!a.stack.visual) add('visual', 'medium', 'Visual regression not wired (screenshot comparison)');
  if (!a.stack.multiBrowser) add('browser', 'low', `Only ${a.browsers?.join(', ') || 'one'} browser configured — spec wants Chrome/Firefox/Safari/Edge`);

  return gaps;
}

// --- main -------------------------------------------------------------------
export function scan(projectRoot = process.cwd()) {
  const root = path.resolve(projectRoot);
  const pkgPath = path.join(root, 'package.json');
  const pkg = existsSync(pkgPath) ? JSON.parse(readSafe(pkgPath)) : {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  const srcRoot = existsSync(path.join(root, 'src')) ? path.join(root, 'src') : root;
  const allFiles = walk(srcRoot);

  // components (reuse the story-tooling detector, then enrich)
  const components = findComponents([srcRoot]).map((c) => {
    const model = analyzeComponent(c);
    const src = c.source;
    return {
      name: c.name,
      file: path.relative(root, c.file),
      exportType: c.exportType,
      props: model.required.map((p) => p.name),
      hasStory: c.hasStory,
      hasTest: hasTestFor(c.dir, c.name),
      // A sibling test for the component, including area-specific names like
      // Foo.table.test.tsx (what `generate --table` emits), so the gap can clear.
      hasAreaTest: hasSiblingAreaTest(c.dir, c.name),
      states: storyStates(model, c.dir, c.name),
      // Phase 6 enrichment: per-component testing signals.
      role: classifyRole(c.name, src),
      renders: { ...model.renders, table: /<table[\s>]/.test(src), list: rendersLocalListOf(src) },
      memoized: isMemoized(src),
      unmemoizedList: rendersUnmemoizedLocalList(src),
      security: detectSecurity(src),
    };
  });

  const { hooks, routes, api, state } = inventory(allFiles);
  // A hook is tested by a sibling test named after its file OR after the hook
  // itself (e.g. useAuth.test.tsx for a useAuth exported from AuthContext.tsx).
  hooks.forEach((h) => (h.hasTest =
    hasTestFor(path.dirname(h.file), path.basename(h.file).replace(/\.\w+$/, '')) ||
    hasTestFor(path.dirname(h.file), h.name)));
  hooks.forEach((h) => (h.file = path.relative(root, h.file)));
  const routingTested = hasRoutingTest(allFiles);
  const catchAll = hasCatchAllRoute(allFiles);
  routes.forEach((r) => ((r.tested = routingTested), (r.file = path.relative(root, r.file))));
  api.forEach((x) => (x.file = path.relative(root, x.file)));
  // A state store is tested if a sibling test exists or any test imports its module.
  state.forEach((s) => ((s.tested = moduleHasTest(s.file, allFiles)), (s.file = path.relative(root, s.file))));

  // Project-level auth surface, with a coverage flag.
  const authSurface = detectAuth(allFiles);
  const auth = authSurface
    ? {
        provider: authSurface.provider ? path.relative(root, authSurface.provider) : null,
        hook: authSurface.hook ? path.relative(root, authSurface.hook) : null,
        guard: authSurface.guard ? path.relative(root, authSurface.guard) : null,
        loginForm: authSurface.loginForm ? path.relative(root, authSurface.loginForm) : null,
        tested: hasAuthTest(allFiles),
      }
    : null;

  const storyFiles = allFiles.filter((f) => STORY_RE.test(f)).length;
  const testFiles = allFiles.filter((f) => TEST_RE.test(f)).length;

  // Browser matrix: union of the Playwright projects (e2e) and the vitest
  // browser `instances` (storybook project), de-duped to canonical engines.
  const browsers = [...new Set([...playwrightBrowsers(root), ...viteBrowsers(root)])];

  // Visual regression is "wired" once a real screenshot-comparison spec exists.
  // Playwright specs usually live OUTSIDE src (e2e/, tests/), so scan those too.
  const specRoots = ['e2e', 'tests', 'test'].map((d) => path.join(root, d)).filter(existsSync);
  const visualWired = hasVisualSpec([...allFiles, ...specRoots.flatMap((d) => walk(d))]);

  const tested = components.filter((c) => c.hasStory || c.hasTest).length;
  const a = {
    scannedAt: null, // stamped by the caller (no Date in shared code)
    root,
    framework: detectFramework(root, deps),
    stack: detectStack(deps, { browsers, visualWired }),
    browsers,
    summary: {
      components: {
        total: components.length,
        tested,
        untested: components.length - tested,
        coveragePct: components.length ? Math.round((tested / components.length) * 100) : 0,
      },
      hooks: { total: hooks.length, tested: hooks.filter((h) => h.hasTest).length },
      routes: routes.length,
      apiFiles: api.length,
      stateStores: state.length,
      storyFiles,
      testFiles,
    },
    components,
    hooks,
    routes,
    routing: { catchAll, tested: routingTested },
    api,
    state,
    auth,
  };
  a.gaps = deriveGaps(a);
  return a;
}
