// Routing + auth E2E against the live Vite app (webServer in playwright.config.ts).
// Covers client-side navigation, the 404 catch-all, the protected-route redirect,
// and a full sign-in flow. Not @visual-tagged, so it runs in `npm run e2e`.
import { test, expect } from '@playwright/test';

test.describe('routing', () => {
  test('navigates between pages via the primary nav', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /component testing workshop/i })
    ).toBeVisible();

    await page.getByRole('link', { name: 'Products' }).click();
    await expect(page.getByRole('table', { name: /product catalog/i })).toBeVisible();
  });

  test('shows the 404 page for an unknown URL', async ({ page }) => {
    await page.goto('/definitely-not-a-real-page');
    await expect(page.getByRole('heading', { name: /404/i })).toBeVisible();
  });

  test('redirects to login when visiting a protected route while logged out', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /^sign in$/i })).toBeVisible();
  });

  test('signs in and reaches the protected dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('demo@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/welcome back/i)).toBeVisible();
  });
});
