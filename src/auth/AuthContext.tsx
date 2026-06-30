import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export interface User {
  email: string;
  name: string;
}

export interface AuthValue {
  /** The signed-in user, or null when logged out. */
  user: User | null;
  /** Resolves with the user on success; rejects with an Error on bad credentials. */
  login: (email: string, password: string) => Promise<User>;
  /** Clears the session. */
  logout: () => void;
}

// Demo-only credential. A real app would call an auth backend; this keeps the
// example self-contained and deterministic (no network) for tests and stories.
export const DEMO_CREDENTIALS = {
  email: 'demo@example.com',
  password: 'password123',
  name: 'Demo User',
};

// Internal (un-exported as `AuthContext`) so the scanner's component detector
// never mistakes this module for a component needing a story.
const AuthCtx = createContext<AuthValue | null>(null);

/**
 * Provides the auth session to the tree. `initialUser` pre-authenticates the
 * provider — handy for stories/tests that need a logged-in starting state.
 */
export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  initialUser?: User | null;
}) {
  const [user, setUser] = useState<User | null>(initialUser);

  const login = useCallback(async (email: string, password: string) => {
    // Simulate an async round-trip without a real network dependency.
    await Promise.resolve();
    if (email === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password) {
      const next: User = { email: DEMO_CREDENTIALS.email, name: DEMO_CREDENTIALS.name };
      setUser(next);
      return next;
    }
    throw new Error('Invalid email or password.');
  }, []);

  const logout = useCallback(() => setUser(null), []);

  const value = useMemo<AuthValue>(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

/** Read the auth session. Throws if used outside an <AuthProvider>. */
export function useAuth(): AuthValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>.');
  return ctx;
}
