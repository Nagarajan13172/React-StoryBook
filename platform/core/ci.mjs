// platform/core/ci.mjs
// ---------------------------------------------------------------------------
// Phase 7 — CI helpers. Pure functions (no I/O) so they're trivially testable:
//   - diffAnalyses(base, head)  → coverage/gap deltas + new/fixed gaps
//   - evaluateGate(head, diff, opts) → { pass, failures[] } for the CI gate
// Both tolerate missing/partial inputs (a fork PR with no base, an empty or
// older-shape baseline) and never throw.
// ---------------------------------------------------------------------------

const coverageOf = (a) => a?.summary?.components?.coveragePct ?? 0;
const gapsOf = (a) => (Array.isArray(a?.gaps) ? a.gaps : []);
const gapKey = (g) => `${g.area}|${g.severity}|${g.message}`;
const countBySeverity = (gaps, sev) => gaps.filter((g) => g.severity === sev).length;

/**
 * Compare a base analysis to the head analysis. New/fixed gaps are an
 * area|severity|message set difference; deltas are numeric.
 */
export function diffAnalyses(base, head) {
  const baseGaps = gapsOf(base);
  const headGaps = gapsOf(head);
  const baseKeys = new Set(baseGaps.map(gapKey));
  const headKeys = new Set(headGaps.map(gapKey));

  const bySeverity = {};
  for (const sev of ['high', 'medium', 'low']) {
    bySeverity[sev] = countBySeverity(headGaps, sev) - countBySeverity(baseGaps, sev);
  }

  return {
    baseCoverage: coverageOf(base),
    headCoverage: coverageOf(head),
    coverageDelta: coverageOf(head) - coverageOf(base),
    gapDelta: headGaps.length - baseGaps.length,
    newGaps: headGaps.filter((g) => !baseKeys.has(gapKey(g))),
    fixedGaps: baseGaps.filter((g) => !headKeys.has(gapKey(g))),
    bySeverity,
  };
}

/**
 * Decide whether the head analysis passes the CI gate.
 *  - minCoverage / maxGaps: absolute thresholds.
 *  - failOnNew (with a diff): a *net* regression vs base — more gaps OR lower
 *    coverage. Deliberately count/coverage based (not message identity) so a gap
 *    whose message merely changed doesn't trip it.
 * No thresholds + no failOnNew ⇒ report-only ⇒ always passes.
 */
export function evaluateGate(head, diff, { minCoverage, maxGaps, failOnNew } = {}) {
  const failures = [];
  const coverage = coverageOf(head);
  const gaps = gapsOf(head).length;

  // `Number.isFinite` (not `!= null`) so a NaN threshold — which makes every
  // comparison silently false — can never neuter the gate. The CLI rejects a
  // non-numeric flag loudly before this point; this is the logic-layer backstop.
  if (Number.isFinite(minCoverage) && coverage < minCoverage) {
    failures.push(`Coverage ${coverage}% is below the required ${minCoverage}%.`);
  }
  if (Number.isFinite(maxGaps) && gaps > maxGaps) {
    failures.push(`${gaps} gap(s) exceed the allowed maximum of ${maxGaps}.`);
  }
  if (failOnNew && diff) {
    if (diff.gapDelta > 0) failures.push(`This change introduces ${diff.gapDelta} net new gap(s) vs the base branch.`);
    if (diff.coverageDelta < 0) failures.push(`Coverage dropped ${Math.abs(diff.coverageDelta)}% vs the base branch.`);
  }

  return { pass: failures.length === 0, failures };
}
