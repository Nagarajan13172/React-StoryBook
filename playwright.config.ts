import { defineConfig, devices } from '@playwright/test';

// Playwright E2E config — the @playwright/test runner. This is SEPARATE from
// vite.config.ts's Vitest `storybook` project (which uses @vitest/browser-playwright
// to run .stories.tsx). Different runner, different testDir ('e2e'), different
// npm script ('e2e'). They never collide.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  // Multi-browser matrix (area 13). Browser binaries: `npx playwright install
  // chromium firefox webkit`. Functional E2E (`npm run e2e`) runs all three;
  // visual snapshots are pinned to chromium (`--project=chromium`) to keep the
  // committed baseline set small and deterministic.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  // Boots the real Vite app and waits for it before running specs.
  webServer: {
    command: 'npm run dev -- --port 5173 --strict-port',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
