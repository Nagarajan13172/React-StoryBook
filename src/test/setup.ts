// Registers jest-dom's custom matchers (toBeInTheDocument, toBeDisabled, ...)
// on Vitest's `expect`, and augments the type definitions so they're typed.
import '@testing-library/jest-dom/vitest';

// --- MSW (Mock Service Worker) for API integration tests -------------------
// Start a single Node-side mock server for the whole `unit` project. This does
// NOT affect tests that make no requests, so it is safe alongside the existing
// jest-dom setup and the Button/Card/etc. unit tests.
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw/server';

// Fail loudly only for unmocked /api/ requests (a forgotten handler), while
// letting any unrelated request a future unit test might make pass through — so
// the strict policy can't couple non-API tests to the MSW handler list.
beforeAll(() =>
  server.listen({
    onUnhandledRequest(request, print) {
      if (new URL(request.url).pathname.startsWith('/api/')) print.error();
    },
  })
);

// Remove any per-test overrides registered via `server.use(...)` so tests stay
// isolated from one another.
afterEach(() => server.resetHandlers());

// Clean up the interceptors once the suite is done.
afterAll(() => server.close());
