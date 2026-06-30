import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, DEMO_CREDENTIALS } from './AuthContext';
import type { User } from './AuthContext';
import { ProtectedRoute } from './ProtectedRoute';

const USER: User = { email: DEMO_CREDENTIALS.email, name: DEMO_CREDENTIALS.name };

function renderAt(path: string, user: User | null) {
  return render(
    <AuthProvider initialUser={user}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<h1>Login Page</h1>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/secret" element={<h1>Secret Area</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('ProtectedRoute', () => {
  it('redirects to /login when logged out', () => {
    renderAt('/secret', null);
    expect(screen.getByRole('heading', { name: /login page/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /secret area/i })).not.toBeInTheDocument();
  });

  it('renders the guarded route when logged in', () => {
    renderAt('/secret', USER);
    expect(screen.getByRole('heading', { name: /secret area/i })).toBeInTheDocument();
  });
});
