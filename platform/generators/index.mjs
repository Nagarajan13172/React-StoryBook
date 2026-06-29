// platform/generators/index.mjs
// ---------------------------------------------------------------------------
// Orchestrates the Phase-2 generators. Given the scanned components and a set
// of target flags, it writes the artifacts and any one-time support files, and
// reports what it did. Never overwrites a hand-written file (only files it owns,
// matched by the GENERATED_MARKER, are refreshed under --force).
// ---------------------------------------------------------------------------
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { findComponents, defaultRoots, GENERATED_MARKER } from '../../scripts/lib/stories.mjs';
import { scan } from '../core/scan.mjs';
import { generateStatesStory } from './stories-matrix.mjs';
import { generateUnitTest } from './vitest-rtl.mjs';
import { generateE2E } from './playwright-e2e.mjs';
import { generateBdd, BDD_SUPPORT } from './cucumber-bdd.mjs';
import { generateMswMocks } from './msw-mock.mjs';
import { generateVisualSpec } from './visual-responsive.mjs';

const rel = (root, p) => path.relative(root, p);

/** Write a generated file unless a hand-written one already sits there. */
function writeOwned(target, content, { force }, log) {
  if (existsSync(target)) {
    const isOurs = readFileSync(target, 'utf8').includes(GENERATED_MARKER);
    if (!isOurs) {
      log.push(`\x1b[33m•\x1b[0m preserved ${target} (hand-written)`);
      return 'preserved';
    }
    if (!force) {
      log.push(`\x1b[90m=\x1b[0m exists    ${target} (use --force to refresh)`);
      return 'exists';
    }
    writeFileSync(target, content);
    log.push(`\x1b[36m↻\x1b[0m refreshed ${target}`);
    return 'refreshed';
  }
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
  log.push(`\x1b[32m＋\x1b[0m created   ${target}`);
  return 'created';
}

export function runGenerators(root, { stories, tests, e2e, bdd, api, visual, force, ignore = [] } = {}) {
  const roots = defaultRoots(root);
  const components = findComponents(roots, { ignore });
  const log = [];
  const counts = { created: 0, refreshed: 0, preserved: 0, exists: 0, skipped: 0 };
  const bump = (r) => counts[r] !== undefined && counts[r]++;

  // `--api` and `--visual` are PROJECT-level: they read the scanned analysis
  // (api files / routes) rather than iterating components. Scan once, lazily.
  const analysis = (api || visual) ? scan(root) : null;

  for (const c of components) {
    if (stories) {
      const s = generateStatesStory(c);
      bump(writeOwned(path.join(c.dir, s.filename), s.content, { force }, log));
    }
    if (tests) {
      const t = generateUnitTest(c);
      bump(writeOwned(path.join(c.dir, t.filename), t.content, { force }, log));
    }
    if (e2e) {
      const f = generateE2E(c);
      if (f.filename) bump(writeOwned(path.join(root, f.filename), f.content, { force }, log));
      else {
        counts.skipped++;
        log.push(`\x1b[90m–\x1b[0m skipped  e2e for <${c.name}/> (${f.skipped})`);
      }
    }
    if (bdd) {
      const f = generateBdd(c);
      if (f.files) {
        for (const file of f.files) bump(writeOwned(path.join(root, file.filename), file.content, { force }, log));
      } else {
        counts.skipped++;
        log.push(`\x1b[90m–\x1b[0m skipped  bdd for <${c.name}/> (${f.skipped})`);
      }
    }
  }

  // One-time BDD support files (World + hooks) when any BDD was requested.
  if (bdd) {
    for (const file of BDD_SUPPORT) bump(writeOwned(path.join(root, file.filename), file.content, { force }, log));
  }

  // --api: MSW handler stubs + per-API-file integration tests (project-level).
  if (api) {
    const r = generateMswMocks(analysis);
    if (r.files) {
      for (const file of r.files) bump(writeOwned(path.join(root, file.filename), file.content, { force }, log));
    } else {
      counts.skipped++;
      log.push(`\x1b[90m–\x1b[0m skipped  api mocks (${r.skipped})`);
    }
  }

  // --visual: one Playwright visual-regression spec across 3 viewports.
  if (visual) {
    const r = generateVisualSpec(analysis);
    if (r.filename) bump(writeOwned(path.join(root, r.filename), r.content, { force }, log));
    else {
      counts.skipped++;
      log.push(`\x1b[90m–\x1b[0m skipped  visual spec (${r.skipped})`);
    }
  }

  return { components: components.map((c) => c.name), log, counts };
}
