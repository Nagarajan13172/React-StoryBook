import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Standalone Vite app for the testing-coverage dashboard. It is deliberately
// separate from the repo's root vite.config.ts (which wires the Storybook/Vitest
// test projects) so the platform UI never interferes with the app under test.
// `ftap dashboard` writes the scanned analysis to public/analysis.json and runs
// this dev server; the app fetches `/analysis.json` at runtime.
const here = fileURLToPath(new URL('.', import.meta.url));
// Port is overridable via FTAP_PORT so two `ftap dashboard` runs (or a busy 4317)
// don't collide. The CLI sets the same env var and builds its logged URL from it,
// keeping strictPort's honest-URL guarantee.
const port = Number(process.env.FTAP_PORT) || 4317;

export default defineConfig({
  root: here,
  plugins: [react()],
  server: { port, strictPort: true },
  preview: { port, strictPort: true },
  build: { outDir: fileURLToPath(new URL('./dist', import.meta.url)), emptyOutDir: true },
});
