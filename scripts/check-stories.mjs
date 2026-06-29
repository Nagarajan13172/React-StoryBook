#!/usr/bin/env node
// scripts/check-stories.mjs
// ---------------------------------------------------------------------------
// Fail (exit 1) if any component is missing a Storybook story. Because the
// Vitest + Storybook addon turns every story into a render + a11y test, "has a
// story" effectively means "is covered by the component test run".
//
// Usage:
//   node scripts/check-stories.mjs                 # scan src/components (or src)
//   node scripts/check-stories.mjs src             # scan all of src
//   node scripts/check-stories.mjs src --ignore=Foo,Bar
//
// Wire it into CI before `test:stories` so a new component without a story
// fails the build instead of silently going untested.
// ---------------------------------------------------------------------------
import path from 'node:path';
import { findComponents, defaultRoots, parseArgs } from './lib/stories.mjs';

const { roots, ignore } = parseArgs(process.argv.slice(2));
const scanRoots = roots.length ? roots : defaultRoots();
const rel = (p) => path.relative(process.cwd(), p);

const components = findComponents(scanRoots, { ignore });
const missing = components.filter((c) => !c.hasStory);

console.log(`Scanned ${components.length} component(s) in ${scanRoots.map(rel).join(', ') || '.'}`);

if (missing.length === 0) {
  console.log(`\x1b[32m✓ Every component has a story.\x1b[0m`);
  process.exit(0);
}

console.error(`\n\x1b[31m✖ ${missing.length} component(s) have no story (so they are untested):\x1b[0m\n`);
for (const c of missing) {
  console.error(`  • ${rel(c.file)}`);
  console.error(`      add  ${rel(path.join(c.dir, `${c.name}.stories.tsx`))}`);
}
console.error(`\nScaffold them automatically with:\n  npm run stories:generate\n`);
process.exit(1);
