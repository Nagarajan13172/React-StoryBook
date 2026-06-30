// platform/generators/auth-flow.mjs
// ---------------------------------------------------------------------------
// Emits an auth-flow test scaffold (jsdom `unit` project) when the scanner
// detects an auth surface (provider / hook / guard / login form). Covers the
// three flows worth testing: a successful login, a rejected login, and a
// protected route redirecting an unauthenticated visitor.
//
// These tests need the app's own provider/guard, so this is a CI-safe scaffold
// with the detected modules referenced and it.todo() placeholders to fill in.
//
//   generateAuthFlowTest(analysis) -> { filename, content } | { skipped }
// ---------------------------------------------------------------------------
import { GENERATED_MARKER } from '../../scripts/lib/stories.mjs';

export function generateAuthFlowTest(analysis) {
  const auth = analysis.auth;
  if (!auth) return { skipped: 'no auth surface detected' };

  const detected = [
    auth.provider && `//   provider:  ${auth.provider}`,
    auth.hook && `//   hook:      ${auth.hook}`,
    auth.guard && `//   guard:     ${auth.guard}`,
    auth.loginForm && `//   loginForm: ${auth.loginForm}`,
  ]
    .filter(Boolean)
    .join('\n');

  const content = `// ${GENERATED_MARKER} — auth-flow test scaffold.
// The scanner detected an auth surface:
${detected}
//
// WIRE IT UP: turn each it.todo() into an assertion using your provider + guard.
// You'll typically want these imports:
//   import { render, screen } from '@testing-library/react';
//   import { MemoryRouter, Routes, Route } from 'react-router-dom';
//   import { AuthProvider } from '${auth.provider ? `../${auth.provider.replace(/\.\w+$/, '')}` : '../src/auth/AuthContext'}';
//   import { ProtectedRoute } from '${auth.guard ? `../${auth.guard.replace(/\.\w+$/, '')}` : '../src/auth/ProtectedRoute'}';
// See src/auth/*.test.tsx in this repo for worked examples.
import { describe, it, expect } from 'vitest';

describe('auth flow', () => {
  it('scaffold is ready to fill in', () => {
    expect(true).toBe(true);
  });

  it.todo('logs in with valid credentials and exposes the user');
  it.todo('rejects invalid credentials and keeps the user logged out');
  it.todo('redirects a guarded route to /login when logged out');
  it.todo('renders the guarded route when logged in');
});
`;

  return { filename: 'src/auth.flow.scaffold.test.tsx', content };
}
