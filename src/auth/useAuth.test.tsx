import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth, DEMO_CREDENTIALS } from './AuthContext';

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe('useAuth', () => {
  it('starts logged out', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
  });

  it('logs in with valid credentials', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password);
    });
    expect(result.current.user).toEqual({
      email: DEMO_CREDENTIALS.email,
      name: DEMO_CREDENTIALS.name,
    });
  });

  it('rejects invalid credentials and stays logged out', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await expect(result.current.login('mallory@example.com', 'wrong')).rejects.toThrow(
        /invalid/i
      );
    });
    expect(result.current.user).toBeNull();
  });

  it('logs out', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password);
    });
    expect(result.current.user).not.toBeNull();
    act(() => result.current.logout());
    expect(result.current.user).toBeNull();
  });

  it('throws when used outside an <AuthProvider>', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});
