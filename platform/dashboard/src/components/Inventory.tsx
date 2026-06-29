import type { Analysis } from '../types';

export function Inventory({ analysis }: { analysis: Analysis }) {
  const { hooks, routes, api, state } = analysis;

  return (
    <section aria-label="Project inventory">
      <h2 className="h2">Inventory</h2>
      <div className="inv">
        <div className="inv__col">
          <h3 className="h3">Hooks ({hooks.length})</h3>
          {hooks.length === 0 ? (
            <p className="muted">none detected</p>
          ) : (
            <ul className="inv__list">
              {hooks.map((h) => (
                <li key={h.file + h.name}>
                  <code>{h.name}</code> {h.hasTest ? <span className="ok">tested</span> : <span className="warn">no test</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="inv__col">
          <h3 className="h3">API integration ({api.length})</h3>
          {api.length === 0 ? (
            <p className="muted">none detected</p>
          ) : (
            <ul className="inv__list">
              {api.map((a) => (
                <li key={a.file}>
                  <code>{a.file}</code>{' '}
                  <span className="muted">{(a.methods ?? []).join(', ') || `${a.calls ?? 0} call(s)`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="inv__col">
          <h3 className="h3">Routes ({routes.length})</h3>
          {routes.length === 0 ? (
            <p className="muted">none detected</p>
          ) : (
            <ul className="inv__list">
              {routes.map((r) => (
                <li key={r.file}>
                  <code>{r.file}</code>
                  {r.paths.length > 0 && <span className="muted"> {r.paths.join(', ')}</span>}{' '}
                  {r.tested ? <span className="ok">tested</span> : <span className="warn">no route test</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="inv__col">
          <h3 className="h3">State stores ({state.length})</h3>
          {state.length === 0 ? <p className="muted">none detected</p> : <ul className="inv__list">{state.map((s) => <li key={s.file}><code>{s.kind}</code> {s.file}</li>)}</ul>}
        </div>
      </div>
    </section>
  );
}
