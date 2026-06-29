# Frontend Testing Automation Platform — Roadmap

Goal (from the spec): a **universal platform** you connect to any React / Next.js
project that **scans** it, **reports** testing gaps, **generates** tests, and helps
**maintain** them — with a dashboard, AI analysis, and CI integration.

This file tracks how we get there. The existing `src/` demo app (Button, Card,
TextField, SignupCard) doubles as the platform's built-in "example project to scan".

---

## Where we are

| Layer | State |
| --- | --- |
| Storybook 10 + Vitest browser-mode component tests | ✅ working |
| a11y enforcement (axe via addon-a11y) | ✅ working |
| Story-coverage check + story generator (`stories:check` / `stories:generate`) | ✅ working (folded into the platform) |
| Scanner + gap report + HTML dashboard (`ftap scan`) | ✅ Phase 1 |
| Multi-target generator: stories / RTL / Playwright / Cucumber (`ftap generate`) | ✅ Phase 2 |
| jsdom unit project · Playwright E2E · Cucumber BDD infra + CI | ✅ Phase 2 |
| MSW API mocking · visual regression · responsive · multi-browser | ✅ Phase 3 |
| Dashboard web app · AI analysis · routing/auth/perf/security coverage | 🔲 to build |

## Architecture

```
platform/
  core/
    scan.mjs      Scanner engine → structured analysis (framework, components,
                  hooks, routes, API, state, tests, stories, stack, gaps)
    report.mjs    analysis → static HTML coverage report
  generators/     story / vitest / playwright / cucumber generators   (Phase 2)
  ai/             Claude-API analysis module                          (Phase 5)
  dashboard/      interactive web UI (React + Vite)                   (Phase 4)
  cli.mjs         `ftap scan | generate | report`
scripts/          existing story tooling (reused by the generator phase)
src/              demo app — the example project the platform scans
```

---

## Phases

- [x] **Phase 0 — Story coverage seed**
  `stories:check` / `stories:generate` + CI gate. (done earlier)

- [ ] **Phase 1 — Scanner + gap report  ← in progress**
  `ftap scan <path>` inspects a project and emits `analysis.json` + `report.html`:
  framework detection, components (props, story coverage, **state-matrix**:
  Default/Loading/Disabled/Error/Empty/Dark/Mobile/Long), hooks, routes, API
  calls, state stores, existing tests, the testing-stack inventory, and a list of
  prioritised gaps with a coverage %. Implements platform features **#1 (Scanner)**
  and a static version of **#2 (Dashboard)**.

- [x] **Phase 2 — Multi-target generator** (feature #3)
  `ftap generate [--stories --tests --e2e --bdd | --all]` emits, per component:
  state-matrix stories (only states a component can express), Vitest + RTL unit
  tests, Playwright E2E flows (form components), and Cucumber `.feature`s + shared
  steps. Plus the infra: jsdom `unit` Vitest project, `playwright.config.ts`,
  `cucumber.json` + World/hooks, npm scripts, and a CI job running all layers.
  Verified: stories 38 ✓ · unit 7 ✓ · e2e 2 ✓ · bdd 2 scenarios/12 steps ✓.

  **Phase 2 — known limitations** (from the adversarial review; deferred, not bugs
  on the demo — every generated artifact for the 4 demo components passes). The
  generators are heuristic/regex-based, so on arbitrary projects:
  - A props type that is imported, extended (`extends`), or not named
    `<Name>Props` yields zero detected props (component under-propped).
  - Multi-field forms generate a flow that fills only the first field, so a
    "valid submission" scenario can still fail; E2E always navigates to `/`, so
    routed pages or components needing providers/context won't render.
  - `renders.*` is a source regex, so it misses elements rendered by imported
    sub-components and can be fooled by commented-out / string-literal matches.
  - Two same-named components in different folders collide for E2E/BDD output.
  These are tracked for an AST-based scanner upgrade (uses the TS compiler API).
  The `platform/__tests__` self-test guards the shapes that ARE handled.

- [x] **Phase 3 — Test infrastructure** (testing areas 5,6,7,13)
  - **API/MSW (7):** `msw@2` Node server wired into the jsdom `unit` project
    (`src/test/msw/*`, `src/test/setup.ts`); example `useUsers` hook +
    presentational `UserList` + `Users` container, with MSW-backed integration
    tests (`Users.test.tsx`, `useUsers.test.tsx`).
  - **Visual + responsive (5,6):** Playwright `toHaveScreenshot` at mobile/
    tablet/desktop (`e2e/visual.spec.ts`, `@visual`-tagged); baselines committed,
    `e2e:visual` / `e2e:visual:update` scripts; manual CI job for Linux baselines.
  - **Multi-browser (13):** `playwright.config.ts` runs chromium + firefox +
    webkit; `npm run e2e` covers all three (verified 6/6).
  - **Platform:** scanner detects msw / multi-browser / visual (Phase-3 gaps
    clear → 0 gaps); new generators `ftap generate --api` (MSW scaffold) and
    `--visual` (viewport screenshot spec); self-tested in `platform/__tests__`.
  Verified: 59 vitest ✓ · e2e 6 (×3 browsers) ✓ · visual 3 ✓ · 21 self-tests ✓.

  **Phase 3 — known limitations** (from the adversarial review; high-impact items
  fixed + self-tested — template-literal URLs → `:params`, depth-correct server
  imports, no method cross-product, route `:param` substitution + slug de-dup,
  `animations:'disabled'`, `/api/`-scoped unhandled-request policy, restored
  story `fetch` stub, `toHaveScreenshot`-only visual detection). Deferred:
  - The MSW generator detects `fetch`/`axios(...)`/`useSWR` string URLs only; it
    misses axios instances, `baseURL` + relative paths, and variable URLs.
  - Visual baselines are platform-suffixed (darwin vs linux) — commit per-OS
    baselines or use the manual CI job; the generated spec doesn't pin an engine.
  - Container components (data-fetching) still need a stubbed/`msw-storybook`
    story to appear in Storybook; only the presentational half auto-generates.

- [ ] **Phase 4 — Dashboard web app** (feature #2)
  Interactive React+Vite UI reading `analysis.json`: tested/untested components,
  coverage %, missing scenarios, drill-down per component.

- [ ] **Phase 5 — AI analysis module** (feature #4)
  Claude API: infer component purpose & expected behaviour, list missing tests,
  suggest concrete test cases, and feed higher-quality generation.

- [ ] **Phase 6 — Auth / routing / table / perf / security coverage**
  Testing areas 9–12, 14 — needs representative components, so partly example-driven.

- [ ] **Phase 7 — CI/CD reports** (feature #5)
  Publish gap report + test results as CI artifacts / PR comments.

---

## Honest scope note

This is a product, not a weekend script. We build it phase by phase, each phase
shippable on its own. Phase 1 (the scanner) is the spine — every later feature
consumes its output.
