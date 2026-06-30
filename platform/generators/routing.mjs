// platform/generators/routing.mjs
// ---------------------------------------------------------------------------
// Emits a routing test scaffold (jsdom `unit` project). Mounts the app's route
// tree in memory via `createMemoryRouter` and checks each detected route plus a
// 404 catch-all and a protected-route redirect.
//
// Routing tests need the app's own route objects, which a heuristic scanner
// can't synthesize — so this is a CI-safe scaffold: a working `renderAt` helper
// + the detected paths as `it.todo` placeholders to fill in. Wire `routes` and
// flip the todos into assertions.
//
//   generateRoutingTest(analysis) -> { filename, content } | { skipped }
// ---------------------------------------------------------------------------
import { GENERATED_MARKER } from '../../scripts/lib/stories.mjs';

export function generateRoutingTest(analysis) {
  const paths = [...new Set((analysis.routes ?? []).flatMap((r) => r.paths ?? []).filter(Boolean))];
  if (!paths.length) return { skipped: 'no routes detected' };

  // Substitute `:params` with a sample and drop the wildcard for the known set.
  const known = paths.map((p) => p.replace(/:[A-Za-z_]\w*/g, '1')).filter((p) => !p.includes('*'));
  const pathList = known.length ? known : ['/'];
  const todoRoutes = pathList.map((p) => `  it.todo('renders the route at ${p}');`).join('\n');

  const content = `// ${GENERATED_MARKER} — routing test scaffold.
// Mounts your route tree in memory and checks each route renders, plus a 404
// and a protected-route redirect. WIRE IT UP: export the route objects you pass
// to createBrowserRouter and import them below, then turn each it.todo() into an
// assertion (see the example at the bottom).
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
// TODO: import your real route objects, e.g. \`import { routes } from '../src/router';\`
const routes: Parameters<typeof createMemoryRouter>[0] = []; // <-- replace with your routes

describe('routing', () => {
  it('mounts the route tree without crashing', () => {
    if (!routes.length) return; // remove this guard once \`routes\` is wired up
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(<RouterProvider router={router} />);
    expect(document.body).toBeTruthy();
  });

${todoRoutes}
  it.todo('redirects protected routes to the login page when logged out');
  it.todo('shows a 404 page for an unknown route');

  // Example, once \`routes\` is wired up:
  //   const router = createMemoryRouter(routes, { initialEntries: ['/no/such/page'] });
  //   render(<RouterProvider router={router} />);
  //   expect(screen.getByRole('heading', { name: /404/i })).toBeInTheDocument();
});
`;

  return { filename: 'src/routing.scaffold.test.tsx', content };
}
