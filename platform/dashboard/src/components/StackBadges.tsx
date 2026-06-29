import type { Analysis } from '../types';

const LABELS: Record<string, string> = {
  vitest: 'Vitest',
  rtl: 'React Testing Library',
  storybookTest: 'Storybook test',
  msw: 'MSW',
  cucumber: 'Cucumber',
  playwright: 'Playwright',
  axe: 'axe (a11y)',
  multiBrowser: 'Multi-browser',
  visual: 'Visual regression',
};

export function StackBadges({ analysis }: { analysis: Analysis }) {
  return (
    <section aria-label="Testing stack">
      <h2 className="h2">Testing stack</h2>
      <div className="badges">
        {Object.entries(analysis.stack).map(([key, on]) => (
          <span key={key} className={`pill ${on ? 'on' : 'off'}`} title={on ? 'configured' : 'not set up'}>
            {on ? '✓' : '○'} {LABELS[key] ?? key}
          </span>
        ))}
        {analysis.browsers.map((b) => (
          <span key={b} className="pill browser" title="browser configured">
            🖥 {b}
          </span>
        ))}
      </div>
    </section>
  );
}
