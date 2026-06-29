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
// in playwright.config.ts are NOT counted as configured browsers.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

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
  if (a.state.length) add('state', 'medium', `State store(s) detected (${[...new Set(a.state.map((s) => s.kind))].join(', ')}) — add state-management tests`);

  if (!a.stack.msw) add('api', 'low', 'MSW not set up (API mocking)');
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
    return {
      name: c.name,
      file: path.relative(root, c.file),
      exportType: c.exportType,
      props: model.required.map((p) => p.name),
      hasStory: c.hasStory,
      hasTest: hasTestFor(c.dir, c.name),
      states: storyStates(model, c.dir, c.name),
    };
  });

  const { hooks, routes, api, state } = inventory(allFiles);
  hooks.forEach((h) => (h.hasTest = hasTestFor(path.dirname(h.file), path.basename(h.file).replace(/\.\w+$/, ''))));
  hooks.forEach((h) => (h.file = path.relative(root, h.file)));
  routes.forEach((r) => ((r.tested = false), (r.file = path.relative(root, r.file))));
  api.forEach((x) => (x.file = path.relative(root, x.file)));
  state.forEach((s) => (s.file = path.relative(root, s.file)));

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
    api,
    state,
  };
  a.gaps = deriveGaps(a);
  return a;
}
