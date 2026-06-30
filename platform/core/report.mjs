// platform/core/report.mjs
// ---------------------------------------------------------------------------
// Render a scan analysis (from scan.mjs) into a self-contained HTML coverage
// report — a static stand-in for the interactive dashboard (Phase 4).
// ---------------------------------------------------------------------------
import { REQUIRED_STATES } from './scan.mjs';

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const sevColor = { high: '#dc2626', medium: '#d97706', low: '#6b7280' };

function bar(pct) {
  const color = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
  return `<div class="bar"><span style="width:${pct}%;background:${color}"></span></div>`;
}

function statePills(states) {
  return REQUIRED_STATES.map((s) => {
    if (states.covered.includes(s)) return `<span class="pill on" title="covered">${s}</span>`;
    if (states.applicable.includes(s)) return `<span class="pill off" title="applicable but missing">${s}</span>`;
    return `<span class="pill na" title="not applicable to this component">${s}</span>`;
  }).join('');
}

export function renderHtml(a) {
  const c = a.summary.components;
  const stackRows = Object.entries(a.stack)
    .map(([k, v]) => `<span class="pill ${v ? 'on' : 'off'}">${k}</span>`)
    .join('');

  const componentRows = a.components
    .map(
      (cp) => `<tr>
        <td><code>${esc(cp.name)}</code><div class="muted">${esc(cp.file)}</div></td>
        <td class="center">${cp.hasStory ? '✅' : '—'}</td>
        <td class="center">${cp.hasTest ? '✅' : '—'}</td>
        <td>${statePills(cp.states)}</td>
      </tr>`
    )
    .join('');

  const gapRows = a.gaps
    .map(
      (g) => `<tr>
        <td><span class="dot" style="background:${sevColor[g.severity]}"></span>${g.severity}</td>
        <td><strong>${esc(g.area)}</strong></td>
        <td>${esc(g.message)}</td>
      </tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Testing gap report — ${esc(a.framework.name)}</title>
<style>
  :root { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
  body { margin: 0; background: #0b1020; color: #e5e7eb; }
  .wrap { max-width: 980px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #94a3b8; margin: 0 0 24px; font-size: 13px; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 0 0 28px; }
  .card { background: #131a30; border: 1px solid #1f2a44; border-radius: 12px; padding: 16px; }
  .card .n { font-size: 28px; font-weight: 700; }
  .card .l { color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .bar { height: 8px; background: #1f2a44; border-radius: 999px; overflow: hidden; margin-top: 8px; }
  .bar span { display: block; height: 100%; }
  h2 { font-size: 15px; margin: 28px 0 10px; color: #cbd5e1; }
  table { width: 100%; border-collapse: collapse; background: #131a30; border-radius: 12px; overflow: hidden; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #1f2a44; font-size: 13px; vertical-align: top; }
  th { color: #94a3b8; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  td.center { text-align: center; }
  code { color: #93c5fd; }
  .muted { color: #64748b; font-size: 11px; margin-top: 2px; }
  .pill { display: inline-block; font-size: 10px; padding: 2px 6px; margin: 1px; border-radius: 999px; }
  .pill.on { background: #064e3b; color: #6ee7b7; }
  .pill.off { background: #3b1d1d; color: #fca5a5; }
  .pill.na { background: #1f2a44; color: #475569; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 999px; margin-right: 6px; }
  .stack { display: flex; flex-wrap: wrap; gap: 4px; }
</style></head>
<body><div class="wrap">
  <h1>Frontend testing gap report</h1>
  <p class="sub">${esc(a.framework.name)} · React ${esc(a.framework.react || '?')} · ${a.framework.typescript ? 'TypeScript' : 'JavaScript'} · ${a.scannedAt ? esc(a.scannedAt) : ''}</p>

  <div class="cards">
    <div class="card"><div class="l">Component coverage</div><div class="n">${c.coveragePct}%</div>${bar(c.coveragePct)}<div class="muted">${c.tested}/${c.total} have a story or test</div></div>
    <div class="card"><div class="l">Untested components</div><div class="n">${c.untested}</div></div>
    <div class="card"><div class="l">Hooks</div><div class="n">${a.summary.hooks.tested}/${a.summary.hooks.total}</div><div class="muted">tested</div></div>
    <div class="card"><div class="l">Gaps found</div><div class="n">${a.gaps.length}</div></div>
  </div>

  <h2>Testing stack</h2>
  <div class="stack">${stackRows}</div>

  <h2>Components — story states (${REQUIRED_STATES.join(' / ')})</h2>
  <table><thead><tr><th>Component</th><th>Story</th><th>Test</th><th>State matrix</th></tr></thead>
  <tbody>${componentRows || '<tr><td colspan="4">No components found.</td></tr>'}</tbody></table>

  <h2>Other inventory</h2>
  <table><tbody>
    <tr><td>Routes</td><td>${a.summary.routes}</td></tr>
    <tr><td>API integration files</td><td>${a.summary.apiFiles}</td></tr>
    <tr><td>State stores</td><td>${a.summary.stateStores}</td></tr>
    <tr><td>Story files / Test files</td><td>${a.summary.storyFiles} / ${a.summary.testFiles}</td></tr>
    <tr><td>Browsers configured</td><td>${a.browsers.join(', ') || 'none'}</td></tr>
  </tbody></table>

  <h2>Prioritised gaps & development plan</h2>
  <table><thead><tr><th>Severity</th><th>Area</th><th>Recommendation</th></tr></thead>
  <tbody>${gapRows || '<tr><td colspan="3">No gaps 🎉</td></tr>'}</tbody></table>
</div></body></html>`;
}

// --- markdown report (Phase 7: CI step summary / PR-friendly) ----------------
const SEV_ORDER = { high: 0, medium: 1, low: 2 };
// Escape pipes + collapse newlines so a gap message is safe inside a md table cell.
const mdCell = (s) => String(s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();

function gapTable(gaps) {
  if (!gaps.length) return 'No gaps 🎉';
  const sorted = [...gaps].sort((a, b) => (SEV_ORDER[a.severity] ?? 3) - (SEV_ORDER[b.severity] ?? 3));
  return [
    '| Severity | Area | Recommendation |',
    '| --- | --- | --- |',
    ...sorted.map((g) => `| ${mdCell(g.severity)} | ${mdCell(g.area)} | ${mdCell(g.message)} |`),
  ].join('\n');
}

/**
 * Render a scan analysis as GitHub-flavoured markdown — the CI step-summary
 * report. When `diff` (from ci.mjs `diffAnalyses`) is supplied, a "Changes vs
 * base" section reports the coverage delta and the new/fixed gaps.
 */
export function renderMarkdown(a, { diff } = {}) {
  const c = a.summary.components;
  const out = [];
  out.push('## 🧪 Frontend testing report');
  out.push('');
  out.push(`**${a.framework.name} · React ${a.framework.react || '?'} · ${a.framework.typescript ? 'TypeScript' : 'JavaScript'}**`);
  out.push('');
  out.push('| Metric | Value |');
  out.push('| --- | --- |');
  out.push(`| Component coverage | **${c.coveragePct}%** (${c.tested}/${c.total}) |`);
  out.push(`| Untested components | ${c.untested} |`);
  out.push(`| Hooks tested | ${a.summary.hooks.tested}/${a.summary.hooks.total} |`);
  out.push(`| Gaps | ${a.gaps.length} |`);
  out.push('');

  if (diff) {
    const arrow = diff.coverageDelta > 0 ? '▲' : diff.coverageDelta < 0 ? '▼' : '—';
    const sign = diff.coverageDelta > 0 ? '+' : '';
    out.push('### Changes vs base');
    out.push(`- **Coverage:** ${diff.baseCoverage}% → ${c.coveragePct}% (${arrow} ${sign}${diff.coverageDelta}%)`);
    out.push(`- **Gaps:** ${diff.gapDelta >= 0 ? '+' : ''}${diff.gapDelta} net (now ${a.gaps.length}) — ${diff.newGaps.length} new, ${diff.fixedGaps.length} fixed`);
    if (diff.newGaps.length) {
      out.push(`- 🆕 **New gaps (${diff.newGaps.length}):**`);
      for (const g of diff.newGaps) out.push(`  - \`${g.severity}\` **${mdCell(g.area)}** — ${mdCell(g.message)}`);
    }
    if (diff.fixedGaps.length) {
      out.push(`- ✅ **Fixed gaps (${diff.fixedGaps.length}):**`);
      for (const g of diff.fixedGaps) out.push(`  - \`${g.severity}\` **${mdCell(g.area)}** — ${mdCell(g.message)}`);
    }
    if (!diff.newGaps.length && !diff.fixedGaps.length) out.push('- No gap changes vs base.');
    out.push('');
  }

  out.push('### Testing stack');
  out.push(Object.entries(a.stack).map(([k, v]) => `${v ? '✅' : '❌'} ${k}`).join(' · '));
  out.push('');
  out.push('### Gaps');
  out.push(gapTable(a.gaps));
  out.push('');
  return out.join('\n');
}
