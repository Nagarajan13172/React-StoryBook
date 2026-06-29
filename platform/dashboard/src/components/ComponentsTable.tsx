import { Fragment, useMemo, useState } from 'react';
import type { ComponentInfo } from '../types';
import { ALL_STATES } from '../types';

type Filter = 'all' | 'untested' | 'gaps';
type SortKey = 'name' | 'coverage';

function statePillClass(state: string, s: ComponentInfo['states']): string {
  if (s.covered.includes(state)) return 'pill on';
  if (s.applicable.includes(state)) return 'pill off'; // applicable but missing
  return 'pill na'; // not applicable to this component
}

function stateCoverage(c: ComponentInfo): number {
  if (!c.states.applicable.length) return 100;
  return Math.round((c.states.covered.length / c.states.applicable.length) * 100);
}

export function ComponentsTable({ components }: { components: ComponentInfo[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = components.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.file.toLowerCase().includes(q)
    );
    if (filter === 'untested') list = list.filter((c) => !c.hasStory && !c.hasTest);
    if (filter === 'gaps') list = list.filter((c) => c.states.missing.length > 0);
    list = [...list].sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : stateCoverage(a) - stateCoverage(b)
    );
    return list;
  }, [components, query, filter, sort]);

  return (
    <section aria-label="Components">
      <div className="table-head">
        <h2 className="h2">Components ({components.length})</h2>
        <div className="controls">
          <input
            className="search"
            type="search"
            placeholder="Search components…"
            value={query}
            aria-label="Search components"
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="chips" role="group" aria-label="Filter">
            {(['all', 'untested', 'gaps'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                className={`chip ${filter === f ? 'chip--on' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'untested' ? 'Untested' : 'Missing states'}
              </button>
            ))}
          </div>
          <button className="chip" onClick={() => setSort((s) => (s === 'name' ? 'coverage' : 'name'))}>
            Sort: {sort === 'name' ? 'Name' : 'Coverage'}
          </button>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Component</th>
            <th className="center">Story</th>
            <th className="center">Test</th>
            <th>State matrix ({ALL_STATES.join(' / ')})</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                No components match.
              </td>
            </tr>
          )}
          {rows.map((c) => {
            // Key/track expansion by file path — component names are NOT unique
            // across a project (two `Card.tsx` in different folders), which would
            // collide React keys and expand every same-named row at once.
            const id = `${c.file}#${c.name}`;
            const open = expanded === id;
            const drillId = `drill-${id}`;
            const toggle = () => setExpanded(open ? null : id);
            return (
              <Fragment key={id}>
                <tr
                  className="row"
                  role="button"
                  tabIndex={0}
                  onClick={toggle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggle();
                    }
                  }}
                  aria-expanded={open}
                  aria-controls={open ? drillId : undefined}
                >
                  <td>
                    <span className="row__caret">{open ? '▾' : '▸'}</span>
                    <code>{c.name}</code>
                    <div className="muted small">{c.file}</div>
                  </td>
                  <td className="center">{c.hasStory ? '✅' : '—'}</td>
                  <td className="center">{c.hasTest ? '✅' : '—'}</td>
                  <td>
                    {ALL_STATES.map((st) => (
                      <span key={st} className={statePillClass(st, c.states)} title={st}>
                        {st}
                      </span>
                    ))}
                  </td>
                </tr>
                {open && (
                  <tr className="drill" id={drillId}>
                    <td colSpan={4}>
                      <div className="drill__grid">
                        <div>
                          <div className="drill__label">Export</div>
                          <code>{c.exportType}</code>
                        </div>
                        <div>
                          <div className="drill__label">Required props</div>
                          {c.props.length ? c.props.map((p) => <code key={p} className="prop">{p}</code>) : <span className="muted">none</span>}
                        </div>
                        <div>
                          <div className="drill__label">Covered states</div>
                          {c.states.covered.length ? c.states.covered.map((s) => <span key={s} className="pill on">{s}</span>) : <span className="muted">none</span>}
                        </div>
                        <div>
                          <div className="drill__label">Missing (applicable) states</div>
                          {c.states.missing.length ? c.states.missing.map((s) => <span key={s} className="pill off">{s}</span>) : <span className="ok">fully covered</span>}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
