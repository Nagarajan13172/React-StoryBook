// platform/generators/cucumber-bdd.mjs
// ---------------------------------------------------------------------------
// Emits Cucumber.js BDD for "flow" components: a per-component .feature file
// plus the shared, reusable pieces (World, hooks, common step definitions).
// The generic steps are defined ONCE (common.steps.ts) so multiple features
// reuse them without "ambiguous step" errors. Steps drive Playwright.
// ---------------------------------------------------------------------------
import { GENERATED_MARKER } from '../../scripts/lib/stories.mjs';
import { analyzeComponent, isFlowComponent, extractFlow } from './lib.mjs';

/** Per-component .feature file (reuses the shared common steps). */
export function generateBdd(component) {
  const model = analyzeComponent(component);
  if (!isFlowComponent(model)) return { skipped: 'not a form/flow component' };
  const { label, isEmail, submit } = extractFlow(component.source);
  if (!label) return { skipped: 'no locatable field label' };

  const valid = isEmail ? 'ada@example.com' : 'Valid input';
  const slug = model.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

  const feature = `# ${GENERATED_MARKER}
Feature: ${model.name} flow
  As a user of the app
  I want the ${model.name} form to validate and submit
  So that I get clear success and error feedback

  Background:
    Given the app is open

  Scenario: A valid submission shows a confirmation
    When I enter "${valid}" into the "${label}" field
    And I click the "${submit}" button
    Then I see a confirmation message

  Scenario: An invalid submission shows a validation error
    When I enter "invalid" into the "${label}" field
    And I click the "${submit}" button
    Then I see a validation error
`;

  return { files: [{ filename: `features/${slug}.feature`, content: feature }] };
}

// --- One-time shared support + step files (written once per project) --------
const WORLD = `// ${GENERATED_MARKER} — Cucumber World (per-scenario Playwright browser).
import { World, setWorldConstructor, setDefaultTimeout, type IWorldOptions } from '@cucumber/cucumber';
import type { Browser, Page } from 'playwright';

setDefaultTimeout(30_000);
export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';

export class AppWorld extends World {
  browser!: Browser;
  page!: Page;
  constructor(options: IWorldOptions) {
    super(options);
  }
}
setWorldConstructor(AppWorld);
`;

const HOOKS = `// ${GENERATED_MARKER} — launch/teardown a headless Chromium per scenario.
import { Before, After } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import { AppWorld } from './world';

Before(async function (this: AppWorld) {
  this.browser = await chromium.launch({ headless: true });
  this.page = await this.browser.newPage();
});

After(async function (this: AppWorld) {
  await this.page?.close();
  await this.browser?.close();
});
`;

const COMMON_STEPS = `// ${GENERATED_MARKER} — reusable steps shared by every generated .feature.
import { Given, When, Then } from '@cucumber/cucumber';
import { strict as assert } from 'node:assert';
import { AppWorld, BASE_URL } from '../support/world';

// Escape regex metacharacters so labels like "Email (required)" don't throw.
const rx = (s: string) => new RegExp(s.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'i');

Given('the app is open', async function (this: AppWorld) {
  await this.page.goto(BASE_URL);
});

When('I enter {string} into the {string} field', async function (this: AppWorld, value: string, label: string) {
  await this.page.getByLabel(rx(label)).fill(value);
});

When('I click the {string} button', async function (this: AppWorld, label: string) {
  await this.page.getByRole('button', { name: rx(label) }).click();
});

Then('I see a confirmation message', async function (this: AppWorld) {
  const status = this.page.getByRole('status');
  await status.waitFor({ state: 'visible' });
  assert.ok(await status.isVisible());
});

Then('I see a validation error', async function (this: AppWorld) {
  const alert = this.page.getByRole('alert');
  await alert.waitFor({ state: 'visible' });
  assert.ok(await alert.isVisible());
});
`;

export const BDD_SUPPORT = [
  { filename: 'features/support/world.ts', content: WORLD },
  { filename: 'features/support/hooks.ts', content: HOOKS },
  { filename: 'features/steps/common.steps.ts', content: COMMON_STEPS },
];
