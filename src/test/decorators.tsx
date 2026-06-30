import type { Decorator } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, DEMO_CREDENTIALS } from '../auth/AuthContext';

/** Wrap a story in an in-memory router (for components using Link/NavLink/router hooks). */
export const withRouter: Decorator = (Story) => (
  <MemoryRouter>
    <Story />
  </MemoryRouter>
);

/** Wrap a story in a logged-out auth provider. */
export const withAuth: Decorator = (Story) => (
  <AuthProvider>
    <Story />
  </AuthProvider>
);

/** Router + logged-out auth provider (for the login flow). */
export const withProviders: Decorator = (Story) => (
  <AuthProvider>
    <MemoryRouter>
      <Story />
    </MemoryRouter>
  </AuthProvider>
);

/** Router + a pre-authenticated provider (for guarded/dashboard views). */
export const withAuthedProviders: Decorator = (Story) => (
  <AuthProvider initialUser={{ email: DEMO_CREDENTIALS.email, name: DEMO_CREDENTIALS.name }}>
    <MemoryRouter>
      <Story />
    </MemoryRouter>
  </AuthProvider>
);
