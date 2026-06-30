import { createBrowserRouter, Outlet } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { Nav } from './components/Nav';
import { Home } from './routes/Home';
import { Products } from './routes/Products';
import { Dashboard } from './routes/Dashboard';
import { Login } from './routes/Login';
import { NotFound } from './routes/NotFound';
import { ProtectedRoute } from './auth/ProtectedRoute';

/** App shell: the primary nav plus the active route's element. */
function RootLayout() {
  return (
    <div className="app">
      <Nav />
      <Outlet />
    </div>
  );
}

/**
 * The route tree, exported so tests can mount the exact same configuration via
 * `createMemoryRouter(routes, { initialEntries })` — no duplicated route map.
 * `/dashboard` sits behind <ProtectedRoute>; `path: '*'` is the 404 catch-all.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'products', element: <Products /> },
      { path: 'login', element: <Login /> },
      {
        element: <ProtectedRoute />,
        children: [{ path: 'dashboard', element: <Dashboard /> }],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
