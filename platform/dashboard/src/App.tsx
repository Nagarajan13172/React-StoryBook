import { useEffect, useState } from 'react';
import type { Analysis } from './types';
import { normalizeAnalysis } from './normalize';
import { SummaryCards } from './components/SummaryCards';
import { StackBadges } from './components/StackBadges';
import { ComponentsTable } from './components/ComponentsTable';
import { GapsList } from './components/GapsList';
import { Inventory } from './components/Inventory';

type Load =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; analysis: Analysis };

export function App() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('analysis.json', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`analysis.json not found (HTTP ${res.status})`);
        // Normalise at the boundary: the file may be partial, hand-edited, or from
        // a different scanner version. Fill safe defaults so no child can crash.
        return normalizeAnalysis(await res.json());
      })
      .then((analysis) => !cancelled && setLoad({ state: 'ready', analysis }))
      .catch((err: unknown) =>
        !cancelled && setLoad({ state: 'error', message: err instanceof Error ? err.message : String(err) })
      );
    return () => {
      cancelled = true;
    };
  }, []);

  if (load.state === 'loading') {
    return (
      <main className="wrap">
        <p role="status" className="muted">
          Loading analysis…
        </p>
      </main>
    );
  }

  if (load.state === 'error') {
    return (
      <main className="wrap">
        <h1 className="title">Testing Coverage Dashboard</h1>
        <p role="alert" className="error-box">
          Couldn’t load <code>analysis.json</code>: {load.message}
          <br />
          Run <code>npm run dashboard</code> (it scans the project and serves this app).
        </p>
      </main>
    );
  }

  const a = load.analysis;
  const scanned = a.scannedAt ? new Date(a.scannedAt) : null;
  const scannedLabel = scanned && !Number.isNaN(scanned.getTime()) ? ` · scanned ${scanned.toLocaleString()}` : '';
  return (
    <main className="wrap">
      <header className="header">
        <h1 className="title">Testing Coverage Dashboard</h1>
        <p className="sub">
          {a.framework.name} · React {a.framework.react ?? '?'} · {a.framework.typescript ? 'TypeScript' : 'JavaScript'}
          {scannedLabel}
        </p>
        {a.root && <p className="sub root">📁 {a.root}</p>}
      </header>

      <SummaryCards analysis={a} />
      <StackBadges analysis={a} />
      <ComponentsTable components={a.components} />
      <GapsList analysis={a} />
      <Inventory analysis={a} />

      <footer className="footer muted">
        ftap — Frontend Testing Automation Platform · {a.components.length} components · {a.gaps.length} gaps
      </footer>
    </main>
  );
}
