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
//   node platform/cli.mjs dashboard [path] [--build] [--port=NNNN]
//                                          scan, then serve the interactive dashboard
//                                          (--build: build then serve via vite preview;
//                                           --port: override the default 4317)
//
// Later phases add: `ai`.
// ---------------------------------------------------------------------------
import { writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { scan } from './core/scan.mjs';
import { renderHtml } from './core/report.mjs';
import { runGenerators } from './generators/index.mjs';

const DASHBOARD_DIR = fileURLToPath(new URL('./dashboard', import.meta.url));

const argv = process.argv.slice(2);
const cmd = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'scan';
const positional = argv.slice(cmd === argv[0] ? 1 : 0).filter((a) => !a.startsWith('-'));
const flags = new Set(argv.filter((a) => a.startsWith('-') && !a.startsWith('--ignore=')));
const ignore = argv.filter((a) => a.startsWith('--ignore=')).flatMap((a) => a.slice('--ignore='.length).split(',')).filter(Boolean);
const portArg = argv.find((a) => a.startsWith('--port='));
const dashboardPort = Number(portArg?.slice('--port='.length)) || Number(process.env.FTAP_PORT) || 4317;
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

function runDashboard() {
  // 1) Scan the target project and drop the analysis where the app can fetch it.
  const a = scan(root);
  a.scannedAt = new Date().toISOString();
  const publicDir = path.join(DASHBOARD_DIR, 'public');
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(path.join(publicDir, 'analysis.json'), JSON.stringify(a, null, 2) + '\n');
  console.log(`\n  \x1b[1mftap dashboard\x1b[0m — scanned ${a.components.length} component(s), ${a.gaps.length} gap(s)`);
  console.log(`  project: ${a.root}`);

  // 2) Launch Vite against the standalone dashboard config. The port is shared
  //    with the config via FTAP_PORT so the URL we print is the one served.
  const config = path.join(DASHBOARD_DIR, 'vite.config.ts');
  const cwd = path.dirname(DASHBOARD_DIR);
  const env = { ...process.env, FTAP_PORT: String(dashboardPort) };
  const url = `http://localhost:${dashboardPort}`;
  const runVite = (args, onExit) =>
    spawn('npx', ['vite', ...args], { stdio: 'inherit', cwd, env }).on('exit', onExit);

  if (has('--build')) {
    // Build, then actually serve the production build so the advertised URL responds
    // (a bare `vite build` exits without serving — connection-refused for the user).
    console.log(`  Building dashboard → dist/, then serving → ${url}\n`);
    runVite(['build', '--config', config], (code) => {
      if (code) return process.exit(code);
      runVite(['preview', '--config', config], (c) => process.exit(c ?? 0));
    });
  } else {
    console.log(`  Serving dashboard → ${url}\n`);
    runVite(['--config', config], (code) => {
      if (code) console.error(`\n  Vite exited (${code}). Port ${dashboardPort} may be in use — retry with --port=NNNN.`);
      process.exit(code ?? 0);
    });
  }
}

switch (cmd) {
  case 'scan':
  case 'report':
    runScan();
    break;
  case 'generate':
    runGenerate();
    break;
  case 'dashboard':
    runDashboard();
    break;
  default:
    console.error(`Unknown command: ${cmd}\nUsage: ftap <scan|report|generate|dashboard> [path] [flags]`);
    process.exit(1);
}
