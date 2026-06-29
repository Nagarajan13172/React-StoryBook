// platform/generators/visual-responsive.mjs
// ---------------------------------------------------------------------------
// Emits a Playwright VISUAL-REGRESSION spec that screenshots the running app at
// three viewports (mobile / tablet / desktop) and asserts against a committed
// baseline via `toHaveScreenshot`. Runs in the @playwright/test runner (same
// webServer/baseURL as the other e2e specs) — NOT in Vitest.
//
// One spec covers the app root by default; if the scanner found routes, it
// screenshots each route path instead (one assertion per route per viewport).
//
// Signature mirrors the other generators:
//   generateVisualSpec(analysis) -> { filename, content } | { skipped }
// ---------------------------------------------------------------------------
import { GENERATED_MARKER } from '../../scripts/lib/stories.mjs';

// Three representative breakpoints. Heights are generous so full-page shots are
// stable; `fullPage: true` captures content below the fold too.
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 }, // iPhone 12-ish
  { name: 'tablet', width: 768, height: 1024 }, // iPad portrait
  { name: 'desktop', width: 1280, height: 800 }, // laptop
];

export function generateVisualSpec(analysis) {
  const raw = [...new Set((analysis.routes ?? []).flatMap((r) => r.paths ?? []).filter(Boolean))];
  // Substitute `:params` with a concrete value and drop catch-all/wildcard
  // routes so page.goto() resolves to a real page (not a literal `/users/:id`).
  let candidates = raw.map((p) => p.replace(/:[A-Za-z_]\w*/g, '1')).filter((p) => !p.includes('*'));
  if (!candidates.length) candidates = ['/'];

  // Pre-compute UNIQUE baseline slugs so two distinct routes never collide on
  // the same snapshot file (e.g. '/users/1' and '/users-1' both → 'users-1').
  const used = new Map();
  const pages = candidates.map((p) => {
    let slug = p.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root';
    const n = used.get(slug) ?? 0;
    used.set(slug, n + 1);
    if (n) slug = `${slug}-${n}`;
    return { path: p, slug };
  });

  const viewportLiteral = VIEWPORTS.map(
    (v) => `  { name: '${v.name}', width: ${v.width}, height: ${v.height} },`
  ).join('\n');
  const pagesLiteral = pages.map((pg) => `  { path: '${pg.path}', slug: '${pg.slug}' },`).join('\n');

  const content = `// ${GENERATED_MARKER} — Playwright visual-regression spec.
// Screenshots ${pages.length === 1 ? 'the app' : 'each page'} at 3 viewports and diffs against a
// committed baseline. First run writes baselines (\`--update-snapshots\`); later
// runs fail on visual drift. Runs against the live app (webServer in
// playwright.config.ts). Pin to one engine via \`--project=chromium\` and commit
// the platform-suffixed baselines it produces.
import { test, expect } from '@playwright/test';

const VIEWPORTS = [
${viewportLiteral}
];

// path = where to navigate; slug = unique baseline filename stem.
const PAGES = [
${pagesLiteral}
];

for (const { path, slug } of PAGES) {
  test.describe(\`visual: \${path}\`, () => {
    for (const vp of VIEWPORTS) {
      // @visual lets functional e2e exclude these (\`--grep-invert @visual\`),
      // since platform-suffixed baselines won't exist on every machine.
      test(\`\${path} @ \${vp.name} (\${vp.width}x\${vp.height}) @visual\`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(path);
        // Settle async paint/fonts so the diff is deterministic.
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveScreenshot(\`\${slug}-\${vp.name}.png\`, {
          fullPage: true,
          // Freeze CSS animations/transitions so a mid-flight frame can't flake.
          animations: 'disabled',
          // Mask anything non-deterministic (dates, avatars, spinners) here:
          // mask: [page.getByTestId('clock')],
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  });
}
`;

  return { filename: 'e2e/visual.spec.ts', content };
}
