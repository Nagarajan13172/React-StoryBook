import type { Analysis } from '../types';

const SEV_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const SEV_COLOR: Record<string, string> = { high: '#dc2626', medium: '#d97706', low: '#6b7280' };
// Unknown/future severities sort last and get a neutral, still-legible chip
// rather than NaN ordering and a transparent (invisible) badge.
const rank = (s: string) => SEV_RANK[s] ?? 99;
const color = (s: string) => SEV_COLOR[s] ?? '#6b7280';

export function GapsList({ analysis }: { analysis: Analysis }) {
  const gaps = [...analysis.gaps].sort((a, b) => rank(a.severity) - rank(b.severity));

  return (
    <section aria-label="Gaps and development plan">
      <h2 className="h2">Prioritised gaps &amp; development plan</h2>
      {gaps.length === 0 ? (
        <p className="empty-good">🎉 No gaps — every component is covered and the stack is fully wired.</p>
      ) : (
        <ul className="gaps">
          {gaps.map((g, i) => (
            <li key={i} className="gap">
              <span className="gap__sev" style={{ background: color(g.severity) }}>
                {g.severity}
              </span>
              <span className="gap__area">{g.area}</span>
              <span className="gap__msg">{g.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
