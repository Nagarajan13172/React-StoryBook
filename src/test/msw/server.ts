// Node-side MSW server for the Vitest `unit` (jsdom) project.
// `setupServer` intercepts requests at the Node http/fetch layer, so the
// global `fetch` used by our hooks is mocked without any network access.
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
