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
| Interactive dashboard web app (`ftap dashboard`) | ✅ Phase 4 |
| AI test-gap analysis (`ftap ai`, Claude API + heuristic) | ✅ Phase 5 |
| Auth · routing · data-table · perf · security coverage | ✅ Phase 6 |
| CI/CD reports — gap report to the run summary + coverage gate (`ftap ci`) | ✅ Phase 7 |

## Architecture

```
platform/
  core/
    scan.mjs      Scanner engine → structured analysis (framework, components +
                  role/security/memo signals, hooks, routes, API, state, auth,
                  tests, stories, stack, gaps)
    report.mjs    analysis → static HTML report + markdown report (CI summary)
    ci.mjs        base↔head diff + coverage-gate logic                  (Phase 7)
  generators/     story / vitest / playwright / cucumber                (Phase 2)
                  msw / visual                                          (Phase 3)
                  routing / auth-flow / table / perf / security         (Phase 6)
  ai/             Claude-API analysis module + heuristic fallback       (Phase 5)
  dashboard/      interactive web UI (React + Vite)                     (Phase 4)
  cli.mjs         `ftap scan | generate | report | dashboard | ai | ci`
scripts/          existing story tooling (reused by the generator phase)
src/              demo app — the example project the platform scans
  routes/         routed pages (Home/Products/Dashboard/Login/NotFound) (Phase 6)
  auth/           AuthContext + useAuth + ProtectedRoute                (Phase 6)
  components/     Button/Card/… + DataTable/BigList/Comment/ExternalLink/
                  LoginForm/Nav                                         (Phase 6)
```

---

## Phases

- [x] **Phase 0 — Story coverage seed**
  `stories:check` / `stories:generate` + CI gate. (done earlier)

- [x] **Phase 1 — Scanner + gap report**
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

- [x] **Phase 4 — Dashboard web app** (feature #2)
  Standalone React 19 + Vite app at `platform/dashboard/`, launched by
  `ftap dashboard [path] [--build] [--port=NNNN]` — it scans the target, writes
  `public/analysis.json`, and serves an interactive UI (dev server, or `--build`
  which builds then serves via `vite preview`). The app fetches `analysis.json`
  at runtime and renders: summary cards with a coverage progressbar, the testing
  stack as on/off badges, a searchable/filterable/sortable components table with
  per-row drill-down (export type, required props, covered/missing states), a
  severity-sorted gaps list, and an inventory (hooks / API / routes / state).
  Verified: tsc 0 errors · vite build ✓ · Playwright 33 checks ✓ (11 happy-path +
  22 hardening against malformed/partial `analysis.json`) · adversarial review
  17/17 findings fixed, 0 new defects.

  **Phase 4 — resilience** (from the adversarial review; all 22 confirmed findings
  fixed + self-verified). The dashboard treats `analysis.json` as untrusted:
  - `normalizeAnalysis()` (`src/normalize.ts`) fills safe defaults for every field
    at the fetch boundary, and a class `ErrorBoundary` wraps `<App/>` as a backstop
    — a partial, hand-edited, or different-version file degrades gracefully instead
    of white-screening (proven with a `{}` payload and a malformed fixture).
  - Table rows are keyboard-operable (`role=button`, `tabIndex`, Enter/Space,
    `aria-controls`, `:focus-visible`) and keyed by unique file path so two
    same-named components expand independently; filter chips are `aria-pressed`
    toggle buttons; the coverage progressbar has an accessible name + `valuetext`
    and a clamped 0–100 value; unknown gap severities sort last with a neutral chip.
  - CLI: `--port`/`FTAP_PORT` keeps the served port and the printed URL in sync;
    `--build` now actually serves the build; the scanned project root is shown so
    stale data is visible. Scanner now detects routing tests (`MemoryRouter` etc.)
    instead of hardcoding `route.tested = false`.

  **Phase 4 — known limitations** (deferred): no list virtualization/pagination, so
  a project with thousands of components renders every row and re-filters the full
  array per keystroke; `analysis.json` is written to the shared install's `public/`
  dir, so two concurrent `ftap dashboard` runs against different projects share that
  file (mitigated by the header showing the scanned root + `--port` for a second
  instance, but not isolated per-run).

- [x] **Phase 5 — AI analysis module** (feature #4)
  `ftap ai [path] [--model=ID] [--only=A,B] [--max=N] [--max-tokens=N] [--md]
  [--json] [--no-ai] [--no-cache]` analyzes each component and reports its inferred
  purpose, key behaviours, and the concrete **missing tests** (story / interaction /
  a11y / e2e / visual) with priorities — writing `ai-analysis.json` (+ optional
  `AI-SUGGESTIONS.md`). It is grounded in the scanner's real coverage so it never
  re-suggests tests that already exist.
  - **Claude path:** dependency-free Messages API client (`platform/ai/client.mjs`)
    using *forced tool use* for guaranteed structured output, with retries/backoff
    and content-hash caching (keyed by source + model + coverage, so adding a story
    busts the entry). Default model `claude-sonnet-4-6`, overridable via `--model` /
    `FTAP_AI_MODEL`; Opus available for max depth.
  - **Key-optional:** with no `ANTHROPIC_API_KEY` (or `--no-ai`) it runs a
    deterministic **heuristic analyzer** (`platform/ai/analyze.mjs`) so the command
    is always useful and CI never needs a key; a per-component API error also falls
    back to the heuristic rather than failing the run.
  - **Feeds generation:** `toSuggestionList()` flattens the analysis into a
    prioritised, generator-friendly checklist (consumed by a future `ftap generate`
    wiring).
  Verified: 47 platform self-tests ✓ (26 Phase-5, all network injected — runs with
  no key, spends no tokens) · gap-finding proven on an under-tested fixture · clean
  machine-parseable `--json` · adversarial review 6/6 findings fixed (truncation /
  empty-tool-input rejection, malformed-body guard, coverage-aware cache key, Record
  edge-case + JSX `role={'alert'}` heuristics, `--max-tokens`).

  **Phase 5 — known limitations** (deferred): the heuristic reasons from structure
  (props/handlers/rendered elements/missing states), not domain semantics, so its
  suggestions are shallower than the Claude path; it keys coverage at the
  story-state + has-test-file granularity and does not parse test bodies (so it
  won't pinpoint which behaviours an existing test already asserts). The suggestion
  list is produced but not yet auto-consumed by the generators. One review lens
  (CLI/security) was blocked by a model-side content filter; security basics (the
  API key is only ever sent as a request header — never logged or written to
  `ai-analysis.json` — and all AI artifacts are gitignored) were verified by hand.

- [x] **Phase 6 — Auth / routing / table / perf / security coverage** (testing areas 9–12, 14)
  Two halves, like every prior phase — representative demo components **and** the
  scanner/generator support to detect + scaffold these areas on any project.

  - **Routing (9):** `react-router-dom@7` wired in. `src/routes/` pages
    (Home/Products/Dashboard/Login/NotFound) behind a `createBrowserRouter` tree
    (`src/router.tsx`, exported so tests reuse it) with a `RootLayout` + `<Nav>`,
    a `path:'*'` 404, and `/dashboard` behind the guard. Tests: `routing.test.tsx`
    (`createMemoryRouter` — route render, 404, protected redirect) + multi-browser
    `e2e/routing.spec.ts`.
  - **Auth (10):** `src/auth/` — `AuthContext` (`AuthProvider` + `useAuth`, demo
    credential, no network), `ProtectedRoute` guard, and a presentational
    `LoginForm`. Tests: `useAuth.test.tsx` (login/logout/reject) +
    `ProtectedRoute.test.tsx` (redirect/allow).
  - **Data table (11):** `DataTable` — semantic `<table>`, `aria-sort` headers,
    labelled filter, pagination, empty state, memoized derivation.
    `DataTable.test.tsx` covers sort/filter/paginate/empty + a11y.
  - **Performance (12):** `BigList` — paginated (DOM budget) + `React.memo`'d rows.
    `BigList.perf.test.tsx` asserts a node budget and that unrelated state doesn't
    re-render memoized rows (deterministic, no wall-clock).
  - **Security (14):** `Comment` (escapes untrusted text — no
    `dangerouslySetInnerHTML`) and `ExternalLink` (forces `rel="noopener
    noreferrer"`, blocks `javascript:`/`data:` hrefs). `security.test.tsx` proves
    XSS payloads stay inert and links are hardened.
  - **Platform:** the scanner gained per-component `role`/`security`/`memoized`
    signals, project-level `auth` + route `catchAll`, and five new gap areas
    (auth/table/perf/security + a routing-404 gap). Two long-standing
    false-positives fixed: the state-store gap now clears when tested, and hooks
    are detected as tested by a hook-named test file. New `ftap generate` targets
    `--routing --auth --table --perf --security` emit marker-guarded scaffolds.
  Verified: tsc + prod build ✓ · 76 platform self-tests ✓ (29 Phase-6) ·
  37 jsdom unit ✓ (25 new) · 93 Storybook render+a11y ✓ (a11y enforced as
  `error`) · 18 e2e (6 × chromium/firefox/webkit) ✓ · 3 visual baselines
  regenerated ✓ · demo scans **0 gaps / 18-18 covered**. Adversarial review:
  9/9 findings fixed + regression-tested — notably the `table` gap now clears via
  its own `--table` scaffold (filename convention aligned, proven end-to-end), the
  `target="_blank"` rel-check is per-occurrence (a safe link no longer masks an
  unsafe one), and the perf gap checks row-level memoization (an unrelated
  `useCallback` no longer suppresses it).

  **Phase 6 — known limitations** (deferred):
  - The scanner is still regex/heuristic (no AST): `detectSecurity` flags a sink
    by shape, so a *sanitized* `dangerouslySetInnerHTML` (e.g. DOMPurify) still
    trips it; `classifyRole`/`rendersLocalListOf` can mis-shape unusual code; a
    router not built with the `react-router` string isn't detected.
  - The new generators emit **CI-safe scaffolds** (a passing smoke test + `it.todo`
    placeholders with the detected specifics), not fully-wired tests — routing/auth
    tests need the app's own route tree/providers and table/perf need sample data,
    which a scanner can't synthesize. The MSW/visual generators stay fully-wired
    because their inputs (URLs/viewports) are fully detectable.
  - Auth uses an in-memory demo credential (no real backend/JWT/refresh); the
    security examples cover escaping + link/protocol sinks, not a full sanitizer
    or CSP.
  - Provider-dependent stories use hand-written `MemoryRouter`/`AuthProvider`
    decorators (`src/test/decorators.tsx`); the `--stories` generator still can't
    infer those. The dashboard surfaces the new gaps in its list but its inventory
    panel isn't yet extended with the auth/table/perf/security signals.

- [x] **Phase 7 — CI/CD reports** (feature #5) — **closes the loop back into CI**
  `ftap ci [path] [--baseline=FILE] [--min-coverage=N] [--max-gaps=N] [--fail-on-new]
  [--md=FILE]` scans the project, renders a GitHub-flavoured **markdown gap report**
  (coverage, stack badges, severity-sorted gaps), writes `report.md`, and **appends it to
  `$GITHUB_STEP_SUMMARY`** so it shows up on every Actions run — no token, works on forks.
  - **Coverage gate:** `evaluateGate` (`platform/core/ci.mjs`) fails the build (exit 1) when
    coverage `< --min-coverage`, gaps `> --max-gaps`, or — with `--fail-on-new` — the change
    is a net regression vs the base branch. No thresholds ⇒ report-only.
  - **Base↔head diff:** `diffAnalyses` compares a base `analysis.json` to head and reports the
    coverage delta + new/fixed gaps in a "Changes vs base" section. The gate uses gap *count* +
    coverage delta (not message identity), so message churn can't fake a regression.
  - **Workflow:** a dependency-free `report` job in `.github/workflows/storybook-tests.yml`
    (no `npm ci` — the scanner only reads `package.json` + source) checks out with
    `fetch-depth: 0`, scans the PR base via `git worktree` (tolerant of fork PRs with no base),
    then runs `ftap ci --min-coverage=100 --max-gaps=0` (+ `--baseline … --fail-on-new` on PRs).
  Verified: 81 platform self-tests ✓ (5 Phase-7) · `ftap ci` exercised end-to-end (clean pass,
  gate failure on a seeded gap, base↔head diff, `$GITHUB_STEP_SUMMARY` append) · workflow YAML
  parses · demo still scans **0 gaps / 18-18** and the existing suites stay green.

  **Phase 7 — known limitations** (deferred): publishes to the Step Summary only (no PR
  comment / artifacts — `report.md` is produced locally if a team wants to wire those up);
  new/fixed gap *display* is message-level, so a gap whose message only changed can show as a
  fixed+new pair (the gate is count/coverage based and unaffected); the diff needs the base ref
  present (`fetch-depth: 0`) — fork PRs without it fall back to absolute-threshold gating.

---

## Status: all phases shipped 🎉

Phases 0–7 are complete — the platform scans a React/Next project, reports and scaffolds the
missing tests across every spec area, surfaces it in a dashboard and AI analysis, and gates +
reports coverage in CI. Each phase remains shippable on its own.

## Honest scope note

This is a product, not a weekend script. We build it phase by phase, each phase
shippable on its own. Phase 1 (the scanner) is the spine — every later feature
consumes its output.
