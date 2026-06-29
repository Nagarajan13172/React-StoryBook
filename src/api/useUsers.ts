import { useEffect, useState } from 'react';

/** A user as returned by the `GET /api/users` endpoint. */
export interface User {
  id: number;
  name: string;
  email: string;
}

/** State exposed by {@link useUsers}. */
export interface UseUsersResult {
  users: User[];
  loading: boolean;
  /** Human-readable error message, or `undefined` when the request succeeded. */
  error?: string;
}

/**
 * Fetches the list of users from `GET /api/users`.
 *
 * Tracks loading / error / data state and aborts the in-flight request on
 * unmount so it never sets state on an unmounted component. Uses the global
 * `fetch` (native on Node 24 and in jsdom), which MSW intercepts in tests.
 */
export function useUsers(): UseUsersResult {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const response = await fetch('/api/users', { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const data = (await response.json()) as User[];
        setUsers(data);
      } catch (err) {
        // Ignore the abort that happens on unmount — it's not a real failure.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  return { users, loading, error };
}
