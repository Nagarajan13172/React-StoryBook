// platform/generators/playwright-e2e.mjs
// ---------------------------------------------------------------------------
// Emits e2e/<name>.spec.ts for "flow" components — ones that render a form (or
// expose a submit-style handler). Drives the real app with @playwright/test,
// filling the detected field and asserting the success (role=status) / error
// (role=alert) outcome. Returns null for non-flow components.
// ---------------------------------------------------------------------------
import { GENERATED_MARKER } from '../../scripts/lib/stories.mjs';
import { analyzeComponent, isFlowComponent, extractFlow } from './lib.mjs';

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function generateE2E(component) {
  const model = analyzeComponent(component);
  if (!isFlowComponent(model)) return { skipped: 'not a form/flow component' };

  const { label, isEmail, submit } = extractFlow(component.source);
  if (!label) return { skipped: 'no locatable field label' };

  const valid = isEmail ? 'alice@example.com' : 'Valid input';
  const slug = model.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  const field = `/${reEsc(label)}/i`;
  const btn = `/${reEsc(submit)}/i`;

  const content = `// ${GENERATED_MARKER} — Playwright E2E flow for <${model.name} />.
// Runs against the live app (webServer in playwright.config.ts). Selectors are
// derived from the component: field "${label}", submit "${submit}",
// success via role="status", validation error via role="alert".
import { test, expect } from '@playwright/test';

test.describe('${model.name} flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('valid submission shows a success status', async ({ page }) => {
    await page.getByLabel(${field}).fill('${valid}');
    await page.getByRole('button', { name: ${btn} }).click();
    await expect(page.getByRole('status')).toBeVisible();
  });

  test('invalid submission surfaces an accessible error', async ({ page }) => {
    await page.getByLabel(${field}).fill('invalid');
    await page.getByRole('button', { name: ${btn} }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
`;

  return { filename: `e2e/${slug}.spec.ts`, content };
}
