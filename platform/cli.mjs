#!/usr/bin/env node
// platform/cli.mjs
// ---------------------------------------------------------------------------
// `ftap` — Frontend Testing Automation Platform CLI.
//
//   node platform/cli.mjs scan [path]      scan a project → analysis.json + report.html
//   node platform/cli.mjs report [path]    alias for scan (writes the HTML report)
//   node platform/cli.mjs generate [path] [--stories --tests --e2e --bdd --api --visual | --all] [--force]
//                                          scaffold tests for every component
//                                          (--api: MSW mocks; --visual: viewport screenshots)
//
// Later phases add: `dashboard`, `ai`.
// ---------------------------------------------------------------------------
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { scan } from './core/scan.mjs';
import { renderHtml } from './core/report.mjs';
import { runGenerators } from './generators/index.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'scan';
const positional = argv.slice(cmd === argv[0] ? 1 : 0).filter((a) => !a.startsWith('-'));
const flags = new Set(argv.filter((a) => a.startsWith('-') && !a.startsWith('--ignore=')));
const ignore = argv.filter((a) => a.startsWith('--ignore=')).flatMap((a) => a.slice('--ignore='.length).split(',')).filter(Boolean);
const root = path.resolve(positional[0] ?? '.');
const has = (f) => flags.has(f);

function runScan() {
  const a = scan(root);
  a.scannedAt = new Date().toISOString(); // safe here: real Node process, not a workflow script

  const outDir = root;
  const jsonPath = path.join(outDir, 'analysis.json');
  const htmlPath = path.join(outDir, 'report.html');
  writeFileSync(jsonPath, JSON.stringify(a, null, 2) + '\n');
  writeFileSync(htmlPath, renderHtml(a));

  const c = a.summary.components;
  console.log(`\n  \x1b[1mFrontend testing scan\x1b[0m — ${a.framework.name} · React ${a.framework.react ?? '?'}`);
  console.log(`  ${'─'.repeat(46)}`);
  console.log(`  Components   ${c.tested}/${c.total} covered  (\x1b[1m${c.coveragePct}%\x1b[0m)`);
  console.log(`  Hooks        ${a.summary.hooks.tested}/${a.summary.hooks.total} tested`);
  console.log(`  Routes       ${a.summary.routes}`);
  console.log(`  API files    ${a.summary.apiFiles}`);
  console.log(`  State stores ${a.summary.stateStores}`);
  console.log(`  Stories/Tests ${a.summary.storyFiles}/${a.summary.testFiles}`);
  console.log(`\n  \x1b[1mTop gaps\x1b[0m (${a.gaps.length} total):`);
  const sev = { high: '\x1b[31m●\x1b[0m', medium: '\x1b[33m●\x1b[0m', low: '\x1b[90m●\x1b[0m' };
  for (const g of a.gaps.slice(0, 8)) console.log(`   ${sev[g.severity]} [${g.area}] ${g.message}`);
  console.log(`\n  → ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`  → ${path.relative(process.cwd(), htmlPath)}   (open in a browser)\n`);
}

function runGenerate() {
  const all = has('--all');
  const targets = {
    stories: all || has('--stories'),
    tests: all || has('--tests'),
    e2e: all || has('--e2e'),
    bdd: all || has('--bdd'),
    api: all || has('--api'),
    visual: all || has('--visual'),
    force: has('--force'),
  };
  if (!targets.stories && !targets.tests && !targets.e2e && !targets.bdd && !targets.api && !targets.visual) {
    console.error('Pick at least one target: --stories --tests --e2e --bdd --api --visual  (or --all). Add --force to refresh generated files.');
    process.exit(1);
  }
  console.log(`\n  \x1b[1mftap generate\x1b[0m → ${Object.entries(targets).filter(([k, v]) => v && k !== 'force').map(([k]) => k).join(', ')}\n`);
  const { components, log, counts } = runGenerators(root, targets);
  for (const line of log) console.log('  ' + line);
  console.log(`\n  Components: ${components.join(', ')}`);
  console.log(`  ${counts.created} created · ${counts.refreshed} refreshed · ${counts.preserved} preserved · ${counts.exists} kept · ${counts.skipped} skipped\n`);
}

switch (cmd) {
  case 'scan':
  case 'report':
    runScan();
    break;
  case 'generate':
    runGenerate();
    break;
  default:
    console.error(`Unknown command: ${cmd}\nUsage: ftap <scan|report|generate> [path] [flags]`);
    process.exit(1);
}
