# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Component testing workshop (Storybook 10 + Vitest)

This project doubles as a **component-testing workshop**: you develop components
visually in Storybook and the *same* stories run as automated tests
(interaction + accessibility) in a **real Chromium browser** via the official
[`@storybook/addon-vitest`](https://storybook.js.org/docs/writing-tests/integrations/vitest-addon).

The demo site (`npm run dev`) is built entirely from the workshop components in
[`src/components/`](src/components) — `Button`, `TextField`, `Card`, and a
composite `SignupCard` — so what you test is exactly what ships.

**Stack:** **Vite 8** · Storybook `10.4.x` · `@storybook/addon-vitest` ·
`@storybook/addon-a11y` · Vitest `4.x` browser mode · `@vitest/browser-playwright` (Chromium).

> **Why Storybook 10?** Storybook **9** only supports Vite ≤ 7. To keep this
> project on **Vite 8** we use Storybook **10**, whose `@storybook/react-vite`
> supports Vite 5/6/7/**8**. If you must stay on Storybook 9, pin the repo to
> Vite 7 instead.

### Day-to-day commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the demo website (Vite) at http://localhost:5173. |
| `npm run storybook` | Open the dev workshop at http://localhost:6006. The **testing widget** (run stories as tests) shows in the sidebar; the **Accessibility** panel shows in the addons panel. |
| `npm run test:stories` | Run every story as a test in **headless Chromium** (interaction `play` functions + a11y checks). This is the command for CI. |
| `npm test` | Run the full Vitest suite (all projects). |
| `npm run test:coverage` | Same as `test:stories`, with a V8 coverage report. |
| `npm run build-storybook` | Build a static Storybook into `storybook-static/`. |

### How it fits together

| File | Role |
| --- | --- |
| `.storybook/main.ts` | Storybook config: framework (`@storybook/react-vite`) + addons (a11y, vitest). |
| `.storybook/preview.ts` | Global parameters. `a11y.test: 'error'` makes a11y violations **fail** the test run. |
| `.storybook/vitest.setup.ts` | Calls `setProjectAnnotations([...])` so stories are tested with the same config they render with. |
| `vite.config.ts` | Holds the Vitest `test.projects` block. The `storybook` project uses `storybookTest()` + Playwright Chromium browser mode (`headless: true`). |
| `src/components/*` | The workshop components, their stories, and interaction tests. |

The example tests cover the patterns you'll reuse: a **click** assertion
(`Button`), a **type** assertion (`TextField`), and a full **submit-and-validate
flow** (`SignupCard`) — each with `expect`, `userEvent`, and `fn` from `storybook/test`.

### Adding a new component story + interaction test

1. Create the component, e.g. `src/components/Badge.tsx`.
2. Add `src/components/Badge.stories.tsx`:

   ```tsx
   import type { Meta, StoryObj } from '@storybook/react-vite';
   import { expect, fn, userEvent, within } from 'storybook/test';
   import { Badge } from './Badge';

   const meta = {
     title: 'Components/Badge',
     component: Badge,
     tags: ['autodocs'],              // generates a Docs page
     args: { onDismiss: fn() },       // fn() spy for assertions + Actions panel
   } satisfies Meta<typeof Badge>;
   export default meta;

   type Story = StoryObj<typeof meta>;

   // A plain state story — rendered in the workshop and a11y-checked as a test.
   export const Default: Story = { args: { label: 'New' } };

   // An interaction test — drives the UI and asserts on the result.
   export const Dismisses: Story = {
     args: { label: 'New', dismissible: true },
     play: async ({ args, canvasElement }) => {
       const canvas = within(canvasElement);
       await userEvent.click(canvas.getByRole('button', { name: /dismiss/i }));
       await expect(args.onDismiss).toHaveBeenCalledTimes(1);
     },
   };
   ```

3. `npm run storybook` to develop it visually, then `npm run test:stories` to run it headless.
   Any story with a `play` function runs as an interaction test; every story is
   automatically accessibility-checked.

### Replicate this setup in another local Vite + React project

Storybook is configured **per project** — you don't copy this folder or install
it globally. For each other app you run the setup once inside that project.

**Option A — one command (recommended).** Use the bundled script from this repo,
pointing it at any local Vite + React project:

```bash
# from this repo:
./scripts/setup-component-testing.sh ~/path/to/my-other-react-app
```

It verifies the target is Vite + React, runs `storybook init`, installs
Playwright Chromium, sets `a11y.test: 'error'`, adds the `test` / `test:stories`
scripts, and writes the CI workflow. Then in that project: `npm run storybook`
and `npm run test:stories`.

**Option B — manual.**

1. On **Vite 8** use Storybook 10 (this setup); on **Vite 5/6/7** you can use Storybook 9 or 10.
2. `npx storybook@latest init --yes` — adds Storybook + the Vitest + a11y addons + the Playwright Chromium browser-mode config.
3. `npx playwright install chromium` (CI: `npx playwright install --with-deps chromium`).
4. Add scripts: `"test:stories": "vitest run --project=storybook"` and `"test": "vitest run"`; set `a11y.test: 'error'` in `.storybook/preview.ts`.
5. Copy `.github/workflows/storybook-tests.yml` to run the stories headless on every PR.
