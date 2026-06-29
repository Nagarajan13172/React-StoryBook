#!/usr/bin/env bash
#
# setup-component-testing.sh
# ---------------------------------------------------------------------------
# Add the Storybook 10 + Vitest browser-mode component-testing workshop to an
# EXISTING Vite + React (TypeScript or JavaScript) project — the same setup used
# in this reference repo.
#
# It will:
#   1. verify the target is a Vite + React project
#   2. run `storybook init` (adds Storybook 10 + addon-vitest + addon-a11y +
#      a Vitest browser-mode project + the Playwright Chromium config)
#   3. install the Playwright Chromium browser binary
#   4. enforce a11y in tests (a11y.test: 'todo' -> 'error')
#   5. add the `test` / `test:stories` / `test:coverage` scripts
#   6. drop in a GitHub Actions workflow that runs the stories headless on PRs
#
# Usage:
#   ./setup-component-testing.sh [path-to-project]
#
#   # set up the project in the current directory:
#   ./setup-component-testing.sh
#
#   # set up another local project:
#   ./setup-component-testing.sh ~/playground/my-other-react-app
#
# Storybook 10 supports Vite 5/6/7/8 and React 16–19, so this works for any
# modern Vite + React app regardless of the package manager (it reuses the
# project's npm / pnpm / yarn automatically).
# ---------------------------------------------------------------------------
set -euo pipefail

# Directory this script lives in — used to copy the story tooling into the target.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TARGET="${1:-.}"
cd "$TARGET"
echo "▶ Setting up component testing in: $(pwd)"
echo

# 1. Sanity check ------------------------------------------------------------
if [ ! -f package.json ]; then
  echo "✖ No package.json here. Run this from (or pass) a Vite + React project root." >&2
  exit 1
fi
node -e 'const p=require("./package.json");const d={...p.dependencies,...p.devDependencies};if(!d.react){console.error("✖ react not found — not a React project.");process.exit(1)}if(!d.vite){console.error("✖ vite not found — not a Vite project.");process.exit(1)}console.log("✓ Detected Vite "+d.vite+" + React "+d.react)'

if [ -d .storybook ]; then
  echo "✖ A .storybook folder already exists — Storybook seems set up already." >&2
  echo "  Remove it first, or run 'npx storybook@latest upgrade' instead." >&2
  exit 1
fi

# Detect the package manager just so we can print the right run commands later.
if   [ -f pnpm-lock.yaml ]; then RUN="pnpm";      else
if   [ -f yarn.lock ];      then RUN="yarn";      else RUN="npm run"; fi; fi

# 2. Initialize Storybook ----------------------------------------------------
echo
echo "▶ Running storybook init (this installs deps and may take a minute)…"
npx storybook@latest init --yes --no-dev --disable-telemetry

# 3. Playwright Chromium -----------------------------------------------------
echo
echo "▶ Ensuring Playwright Chromium is installed…"
npx playwright install chromium

# 4. Enforce accessibility in tests -----------------------------------------
PREVIEW=".storybook/preview.ts"
[ -f "$PREVIEW" ] || PREVIEW=".storybook/preview.tsx"
[ -f "$PREVIEW" ] || PREVIEW=".storybook/preview.js"
if [ -f "$PREVIEW" ] && grep -q "test: 'todo'" "$PREVIEW"; then
  perl -0pi -e "s/test:\s*'todo'/test: 'error'/" "$PREVIEW"
  echo "✓ a11y.test set to 'error' in $PREVIEW (a11y violations now fail tests)"
else
  echo "• Set a11y.test: 'error' manually in your .storybook/preview file to enforce a11y."
fi

# 5. Copy the "every component needs a story" tooling -----------------------
echo
echo "▶ Installing story tooling into ./scripts …"
mkdir -p scripts/lib
cp "$SCRIPT_DIR/check-stories.mjs"    scripts/check-stories.mjs
cp "$SCRIPT_DIR/generate-stories.mjs" scripts/generate-stories.mjs
cp "$SCRIPT_DIR/lib/stories.mjs"      scripts/lib/stories.mjs
echo "✓ Copied check-stories.mjs, generate-stories.mjs, lib/stories.mjs"

# 6. Add the day-to-day scripts ---------------------------------------------
node -e '
  const fs = require("fs");
  const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
  p.scripts = p.scripts || {};
  if (!p.scripts.test || /no test specified/.test(p.scripts.test)) p.scripts.test = "vitest run";
  p.scripts["test:stories"] = "vitest run --project=storybook";
  p.scripts["test:coverage"] = "vitest run --project=storybook --coverage";
  p.scripts["stories:check"] = "node scripts/check-stories.mjs";
  p.scripts["stories:generate"] = "node scripts/generate-stories.mjs";
  fs.writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n");
  console.log("✓ Added scripts: test, test:stories, test:coverage, stories:check, stories:generate");
'

# 7. CI workflow (assumes npm — tweak the install/run lines for pnpm/yarn) ---
mkdir -p .github/workflows
cat > .github/workflows/storybook-tests.yml <<'YAML'
name: Storybook tests
on:
  pull_request:
  workflow_dispatch:
jobs:
  test-stories:
    name: Run Storybook stories (headless Chromium)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      # Fail the build if any component is missing a story (i.e. is untested).
      - run: npm run stories:check
      - run: npm run test:stories
YAML
echo "✓ Wrote .github/workflows/storybook-tests.yml"

# Done -----------------------------------------------------------------------
echo
echo "✅ Component testing is set up. Next:"
echo "   $RUN storybook         # open the workshop at http://localhost:6006"
echo "   $RUN stories:generate  # scaffold a default story for every component missing one"
echo "   $RUN stories:check     # fail if any component still has no story (runs in CI too)"
echo "   $RUN test:stories      # run your stories as headless-Chromium tests"
echo
echo "Add a *.stories.tsx next to any component to see it appear as both a"
echo "visual story and an automated test. \`stories:check\` keeps that honest."
