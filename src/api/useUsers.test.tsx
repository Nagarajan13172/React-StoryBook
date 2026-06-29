import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { useUsers } from './useUsers';
import { server } from '../test/msw/server';

// Unit tests for the data hook itself (area 7: API integration). The endpoint is
// mocked with MSW (see src/test/setup.ts), so no real network is hit.
describe('useUsers', () => {
  it('starts loading, then resolves with users from GET /api/users', async () => {
    const { result } = renderHook(() => useUsers());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.users).toHaveLength(2);
    expect(result.current.users[0].name).toBe('Ada Lovelace');
    expect(result.current.error).toBeUndefined();
  });

  it('exposes an error message when the request fails', async () => {
    // Override the default handler for this test only (reset in afterEach).
    server.use(http.get('/api/users', () => new HttpResponse(null, { status: 500 })));

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toMatch(/500/);
    expect(result.current.users).toHaveLength(0);
  });
});
