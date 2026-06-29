#!/usr/bin/env node
// scripts/generate-stories.mjs
// ---------------------------------------------------------------------------
// Scaffold a default `<Component>.stories.tsx` next to every component that
// doesn't already have one. Each generated story renders the component with
// best-effort default args, which immediately gives you a render smoke-test and
// an accessibility check via the Vitest + Storybook addon. Add `play` functions
// afterwards to assert behaviour.
//
// Usage:
//   node scripts/generate-stories.mjs               # scaffold missing stories
//   node scripts/generate-stories.mjs src           # scan all of src
//   node scripts/generate-stories.mjs --force       # also refresh previously
//                                                   # generated stubs
//   node scripts/generate-stories.mjs --ignore=Foo
//
// It never overwrites a story you wrote by hand. --force only refreshes stubs
// this generator created (identified by the GENERATED_MARKER comment).
// ---------------------------------------------------------------------------
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { findComponents, defaultRoots, parseArgs, storyTemplate, GENERATED_MARKER } from './lib/stories.mjs';

const { roots, ignore, force } = parseArgs(process.argv.slice(2));
const scanRoots = roots.length ? roots : defaultRoots();
const rel = (p) => path.relative(process.cwd(), p);

/** Locate an existing sibling story file, if any. */
function existingStory(dir, name) {
  for (const ext of ['tsx', 'ts', 'jsx', 'js']) {
    const f = path.join(dir, `${name}.stories.${ext}`);
    if (existsSync(f)) return f;
  }
  return null;
}

const components = findComponents(scanRoots, { ignore });

let created = 0;
let refreshed = 0;
let preserved = 0;

for (const c of components) {
  const existing = existingStory(c.dir, c.name);

  if (!existing) {
    const target = path.join(c.dir, `${c.name}.stories.tsx`);
    writeFileSync(target, storyTemplate(c));
    console.log(`\x1b[32m＋\x1b[0m created  ${rel(target)}`);
    created++;
    continue;
  }

  if (!force) continue; // has a story, no --force → leave it alone

  // --force: only refresh our own generated stubs; never hand-written stories.
  const isGenerated = readFileSync(existing, 'utf8').includes(GENERATED_MARKER);
  if (isGenerated) {
    writeFileSync(existing, storyTemplate(c));
    console.log(`\x1b[36m↻\x1b[0m refreshed ${rel(existing)}`);
    refreshed++;
  } else {
    console.log(`\x1b[33m•\x1b[0m preserved ${rel(existing)} (hand-written — not overwritten)`);
    preserved++;
  }
}

if (created + refreshed === 0) {
  console.log(`\x1b[32m✓ Nothing to scaffold — every component already has a story.\x1b[0m`);
  if (preserved) console.log(`  (${preserved} hand-written story file(s) left untouched.)`);
  process.exit(0);
}

const parts = [created && `${created} created`, refreshed && `${refreshed} refreshed`, preserved && `${preserved} preserved`].filter(Boolean);
console.log(`\n${parts.join(', ')}. Review the args/TODOs, then run:\n  npm run test:stories\n`);
