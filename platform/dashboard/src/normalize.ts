import type { Analysis, ComponentInfo, Gap } from './types';

// The dashboard fetches analysis.json and trusts nothing about its shape: it may
// come from an older/newer scanner, a partial write, or a hand edit. Normalising
// once at the data boundary (here) means every child component can dereference
// fields freely without a crash blanking the page. The ErrorBoundary is the
// backstop for anything this misses.

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

function normComponent(c: any): ComponentInfo {
  const s = c?.states ?? {};
  return {
    name: str(c?.name, '(unnamed)'),
    file: str(c?.file),
    exportType: c?.exportType === 'default' ? 'default' : 'named',
    props: arr<string>(c?.props).map((p) => str(p)),
    hasStory: !!c?.hasStory,
    hasTest: !!c?.hasTest,
    states: {
      applicable: arr<string>(s.applicable).map((x) => str(x)),
      covered: arr<string>(s.covered).map((x) => str(x)),
      missing: arr<string>(s.missing).map((x) => str(x)),
    },
  };
}

function normGap(g: any): Gap {
  return {
    area: str(g?.area, 'general'),
    // Preserve the original severity string — GapsList renders unknown/future
    // severities with a neutral chip and sorts them last, so collapsing them to
    // 'low' here would only mislabel them.
    severity: str(g?.severity, 'low') as Gap['severity'],
    message: str(g?.message),
  };
}

export function normalizeAnalysis(raw: any): Analysis {
  const summary = raw?.summary ?? {};
  const comp = summary.components ?? {};
  const hooks = summary.hooks ?? {};
  return {
    scannedAt: typeof raw?.scannedAt === 'string' ? raw.scannedAt : null,
    root: str(raw?.root),
    framework: {
      name: str(raw?.framework?.name, 'unknown'),
      react: typeof raw?.framework?.react === 'string' ? raw.framework.react : null,
      typescript: !!raw?.framework?.typescript,
      nextAppRouter: raw?.framework?.nextAppRouter,
    },
    stack:
      raw?.stack && typeof raw.stack === 'object' && !Array.isArray(raw.stack)
        ? (raw.stack as Record<string, boolean>)
        : {},
    browsers: arr<string>(raw?.browsers).map((b) => str(b)),
    summary: {
      components: {
        total: num(comp.total),
        tested: num(comp.tested),
        untested: num(comp.untested),
        coveragePct: num(comp.coveragePct),
      },
      hooks: { total: num(hooks.total), tested: num(hooks.tested) },
      routes: num(summary.routes),
      apiFiles: num(summary.apiFiles),
      stateStores: num(summary.stateStores),
      storyFiles: num(summary.storyFiles),
      testFiles: num(summary.testFiles),
    },
    components: arr<any>(raw?.components).map(normComponent),
    hooks: arr<any>(raw?.hooks).map((h) => ({
      name: str(h?.name),
      file: str(h?.file),
      hasTest: !!h?.hasTest,
    })),
    routes: arr<any>(raw?.routes).map((r) => ({
      file: str(r?.file),
      paths: arr<string>(r?.paths).map((p) => str(p)),
      tested: !!r?.tested,
    })),
    api: arr<any>(raw?.api).map((x) => ({
      file: str(x?.file),
      calls: num(x?.calls),
      methods: arr<string>(x?.methods).map((m) => str(m)),
    })),
    state: arr<any>(raw?.state).map((s) => ({ kind: str(s?.kind), file: str(s?.file) })),
    gaps: arr<any>(raw?.gaps).map(normGap),
  };
}
