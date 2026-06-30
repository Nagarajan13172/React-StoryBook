// platform/__tests__/phase7-ci.test.mjs
// ---------------------------------------------------------------------------
// Phase-7 CI report + gate. The markdown renderer (report.mjs) and the diff +
// gate logic (ci.mjs) are pure functions, so we feed synthetic analyses and
// assert the output/decisions directly.
//   run:  node --test platform/__tests__/
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../core/report.mjs';
import { diffAnalyses, evaluateGate } from '../core/ci.mjs';

const mkAnalysis = ({ coveragePct = 100, tested = 1, total = 1, gaps = [] } = {}) => ({
  framework: { name: 'vite', react: '19', typescript: true },
  stack: { vitest: true, msw: false },
  summary: {
    components: { coveragePct, tested, total, untested: total - tested },
    hooks: { tested: 1, total: 1 },
  },
  gaps,
});

// --- renderMarkdown ---------------------------------------------------------
test('renderMarkdown: clean report shows coverage, stack badges, and "No gaps"', () => {
  const md = renderMarkdown(mkAnalysis());
  assert.match(md, /Component coverage \| \*\*100%\*\* \(1\/1\)/);
  assert.match(md, /✅ vitest/);
  assert.match(md, /❌ msw/);
  assert.match(md, /No gaps/);
});

test('renderMarkdown: gaps render as a table with pipes escaped', () => {
  const md = renderMarkdown(mkAnalysis({ gaps: [{ area: 'security', severity: 'high', message: 'sink | risky' }] }));
  assert.match(md, /\| Severity \| Area \| Recommendation \|/);
  assert.match(md, /\| high \| security \| sink \\\| risky \|/);
});

test('renderMarkdown: a diff adds a "Changes vs base" section listing new/fixed gaps', () => {
  const base = mkAnalysis({ coveragePct: 90, gaps: [{ area: 'perf', severity: 'medium', message: 'old' }] });
  const head = mkAnalysis({ coveragePct: 100, gaps: [{ area: 'auth', severity: 'high', message: 'new' }] });
  const md = renderMarkdown(head, { diff: diffAnalyses(base, head) });
  assert.match(md, /### Changes vs base/);
  assert.match(md, /90% → 100%/);
  assert.match(md, /New gaps \(1\)/);
  assert.match(md, /Fixed gaps \(1\)/);
});

// --- diffAnalyses -----------------------------------------------------------
test('diffAnalyses: computes deltas + new/fixed gaps and is safe on an empty base', () => {
  const base = mkAnalysis({ coveragePct: 80, gaps: [{ area: 'a', severity: 'low', message: 'x' }] });
  const head = mkAnalysis({ coveragePct: 100, gaps: [{ area: 'b', severity: 'high', message: 'y' }] });
  const d = diffAnalyses(base, head);
  assert.equal(d.coverageDelta, 20);
  assert.equal(d.gapDelta, 0);
  assert.deepEqual(d.newGaps.map((g) => g.area), ['b']);
  assert.deepEqual(d.fixedGaps.map((g) => g.area), ['a']);

  const safe = diffAnalyses({}, head);
  assert.equal(safe.baseCoverage, 0);
  assert.equal(safe.coverageDelta, 100);
  assert.equal(safe.newGaps.length, 1);
  assert.equal(safe.fixedGaps.length, 0);
});

// --- evaluateGate -----------------------------------------------------------
test('evaluateGate: report-only passes; thresholds + regressions fail', () => {
  const clean = mkAnalysis({ coveragePct: 100, gaps: [] });

  assert.equal(evaluateGate(clean, null, {}).pass, true); // no thresholds → report-only
  assert.equal(evaluateGate(mkAnalysis({ coveragePct: 80 }), null, { minCoverage: 100 }).pass, false);
  assert.equal(
    evaluateGate(mkAnalysis({ gaps: [{ area: 'a', severity: 'low', message: 'x' }] }), null, { maxGaps: 0 }).pass,
    false
  );
  // fail-on-new: a net regression vs base (more gaps OR lower coverage).
  assert.equal(evaluateGate(clean, { gapDelta: 1, coverageDelta: 0 }, { failOnNew: true }).pass, false);
  assert.equal(evaluateGate(clean, { gapDelta: 0, coverageDelta: -5 }, { failOnNew: true }).pass, false);
  // fail-on-new with no diff (e.g. fork PR without a base) is a no-op.
  assert.equal(evaluateGate(clean, null, { failOnNew: true }).pass, true);
  // a clean change passes the strict bar with every gate enabled.
  const ok = evaluateGate(clean, { gapDelta: 0, coverageDelta: 0 }, { minCoverage: 100, maxGaps: 0, failOnNew: true });
  assert.equal(ok.pass, true);
  assert.equal(ok.failures.length, 0);
});

test('evaluateGate: a non-finite (NaN) threshold is ignored, never silently disabling the gate', () => {
  // NaN comparisons are always false; the isFinite backstop means a NaN threshold
  // is treated as "unset" rather than an unconditional pass. (The CLI also rejects
  // a non-numeric flag loudly with a non-zero exit.)
  const under = mkAnalysis({ coveragePct: 50, gaps: [{ area: 'a', severity: 'low', message: 'x' }] });
  assert.equal(evaluateGate(under, null, { minCoverage: NaN, maxGaps: NaN }).pass, true);
  // A real threshold still fails it.
  assert.equal(evaluateGate(under, null, { minCoverage: 100 }).pass, false);
});
