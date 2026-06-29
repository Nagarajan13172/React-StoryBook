// Visual-regression + responsive screenshots for the live app at '/'.
// Runs with Playwright's BUILT-IN screenshot comparison — no Chromatic / no
// external service. The webServer in playwright.config.ts boots the real Vite
// app first, so these specs hit the same '/' as the other E2E flows.
//
// Three breakpoints are screenshotted, each in its own `test.describe` that
// pins a viewport via `test.use({ viewport })`. Naming the snapshot explicitly
// (e.g. 'home-mobile.png') keeps baselines stable even if the test title moves.
//
// Baselines live next to this file in `e2e/visual.spec.ts-snapshots/` and are
// platform-suffixed by Playwright (e.g. `home-mobile-chromium-darwin.png`).
// They MUST be committed. See README / package scripts for baseline management.
import { test, expect, type Page } from '@playwright/test';

const VIEWPORTS = {
  mobile: { width: 390, height: 844 }, // iPhone 14-ish
  tablet: { width: 820, height: 1180 }, // iPad Air portrait
  desktop: { width: 1280, height: 800 }, // common laptop
} as const;

// Deterministic readiness wait: app is client-rendered into #root, so wait for
// real content (the SignupCard's "Subscribe" button) instead of an arbitrary
// timeout. Then let fonts settle so glyph metrics are stable.
async function gotoHome(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: /Component Testing Workshop/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Subscribe/i })).toBeVisible();
  // Ensure web/icon fonts are fully loaded before snapshotting.
  await page.evaluate(() => document.fonts.ready);
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`home @ ${name} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport });

    // The `@visual` tag lets the default `npm run e2e` job exclude these via
    // `--grep-invert @visual`, so functional E2E stays green on CI even when
    // platform-suffixed baselines (darwin vs linux) don't exist there.
    test(`matches the ${name} baseline @visual`, async ({ page }) => {
      await gotoHome(page);

      // Mask the animated loading spinner so its frozen frame can't flake.
      const spinner = page.locator('.ws-button__spinner');

      await expect(page).toHaveScreenshot(`home-${name}.png`, {
        // Capture the whole scrollable page, not just the viewport box.
        fullPage: true,
        // Freeze CSS animations/transitions and finish them at their end state.
        animations: 'disabled',
        // ~1% of pixels may differ (font AA / sub-pixel rounding across
        // machines) before failing. Keep small; raise only if CI proves noisy.
        maxDiffPixelRatio: 0.01,
        // Per-pixel color tolerance (0..1). Smooths anti-aliasing noise.
        threshold: 0.2,
        // The frozen spinner frame is still nondeterministic, so mask it out.
        mask: [spinner],
      });
    });
  });
}
