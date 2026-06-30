import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../router';
import { AuthProvider, DEMO_CREDENTIALS } from '../auth/AuthContext';
import type { User } from '../auth/AuthContext';

const USER: User = { email: DEMO_CREDENTIALS.email, name: DEMO_CREDENTIALS.name };

// Mount the app's real route tree at a given path, with an optional signed-in user.
function renderAt(path: string, user: User | null = null) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <AuthProvider initialUser={user}>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

describe('app routing', () => {
  it('renders the home page at /', () => {
    renderAt('/');
    expect(
      screen.getByRole('heading', { name: /component testing workshop/i })
    ).toBeInTheDocument();
  });

  it('renders the products table at /products', () => {
    renderAt('/products');
    expect(screen.getByRole('table', { name: /product catalog/i })).toBeInTheDocument();
  });

  it('shows the 404 page for an unknown route', () => {
    renderAt('/no/such/page');
    expect(screen.getByRole('heading', { name: /404/i })).toBeInTheDocument();
  });

  it('redirects /dashboard to the login page when logged out', () => {
    renderAt('/dashboard', null);
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders the protected dashboard when logged in', () => {
    renderAt('/dashboard', USER);
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    expect(screen.getByText(DEMO_CREDENTIALS.name)).toBeInTheDocument();
  });
});
