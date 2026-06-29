// MSW v2 request handlers shared by the Node test server (and any browser worker).
// v2 uses the `http` namespace (not `rest`) and `HttpResponse` for typed responses.
import { http, HttpResponse } from 'msw';
import type { User } from '../../api/useUsers';

/** Default, "happy path" data returned by GET /api/users. */
export const usersFixture: User[] = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' },
  { id: 2, name: 'Alan Turing', email: 'alan@example.com' },
];

/**
 * Default handlers. Individual tests can override these at runtime with
 * `server.use(...)` (e.g. to simulate an error) — overrides are cleared by
 * `server.resetHandlers()` in `afterEach`.
 */
export const handlers = [
  http.get('/api/users', () => {
    return HttpResponse.json(usersFixture);
  }),
];
