import type { Analysis } from '../types';

function CoverageBar({ pct, labelledBy }: { pct: number; labelledBy?: string }) {
  // Clamp: a hand-edited / out-of-range coveragePct must never overflow the
  // track (width:150%) nor reverse it (negative), and aria-valuenow must be a
  // valid 0–100 number for screen readers.
  const safe = Math.max(0, Math.min(100, Number(pct) || 0));
  const color = safe >= 80 ? '#16a34a' : safe >= 50 ? '#d97706' : '#dc2626';
  return (
    <div
      className="bar"
      role="progressbar"
      aria-labelledby={labelledBy}
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${safe}% covered`}
    >
      <span style={{ width: `${safe}%`, background: color }} />
    </div>
  );
}

export function SummaryCards({ analysis }: { analysis: Analysis }) {
  const c = analysis.summary.components;
  const highGaps = analysis.gaps.filter((g) => g.severity === 'high').length;

  return (
    <section className="cards" aria-label="Summary">
      <div className="card">
        <div className="card__label" id="coverage-label">Component coverage</div>
        <div className="card__n">{c.coveragePct}%</div>
        <CoverageBar pct={c.coveragePct} labelledBy="coverage-label" />
        <div className="card__sub">
          {c.tested}/{c.total} have a story or test
        </div>
      </div>
      <div className="card">
        <div className="card__label">Untested components</div>
        <div className="card__n" style={{ color: c.untested ? '#fca5a5' : '#6ee7b7' }}>
          {c.untested}
        </div>
        <div className="card__sub">need a story or test</div>
      </div>
      <div className="card">
        <div className="card__label">Hooks tested</div>
        <div className="card__n">
          {analysis.summary.hooks.tested}/{analysis.summary.hooks.total}
        </div>
        <div className="card__sub">{analysis.summary.testFiles} test files total</div>
      </div>
      <div className="card">
        <div className="card__label">Gaps found</div>
        <div className="card__n" style={{ color: analysis.gaps.length ? '#fcd34d' : '#6ee7b7' }}>
          {analysis.gaps.length}
        </div>
        <div className="card__sub">{highGaps} high severity</div>
      </div>
    </section>
  );
}
