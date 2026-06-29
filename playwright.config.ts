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
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Add later, then `npx playwright install firefox webkit`:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',  use: { ...devices['Desktop Safari'] } },
  ],
  // Boots the real Vite app and waits for it before running specs.
  webServer: {
    command: 'npm run dev -- --port 5173 --strict-port',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
