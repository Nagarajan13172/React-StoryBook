// platform/generators/msw-mock.mjs
// ---------------------------------------------------------------------------
// Emits MSW (Mock Service Worker) scaffolding for each API file the scanner
// found. For every detected endpoint it adds a best-effort `http.*` handler
// stub, and for every API file it emits an integration test that renders the
// hook/module against the Node MSW server (the jsdom `unit` project).
//
// This is an HONEST scaffold: MSW v2 + a Node server are wired correctly, but
// the endpoint URLs/methods are heuristic guesses pulled from the source — each
// emitted handler/assertion carries a `// TODO` so the author confirms it.
//
// Signature mirrors the other generators:
//   generateMswMocks(analysis) -> { files: [{ filename, content }] } | { skipped }
// It takes the whole `analysis` (not a single component) because MSW is a
// project-level concern keyed off `analysis.api`, not off components.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GENERATED_MARKER } from '../../scripts/lib/stories.mjs';

// Files that are MSW *infrastructure*, not application API code. The scanner's
// fetch/axios regex matches the word "fetch" even inside these files' comments,
// so we must exclude them here or we'd generate a mock-for-the-mock (double count).
const MSW_INFRA_RE = /(?:^|[\\/])(?:test[\\/]msw|mocks|__mocks__)[\\/]/;

/** Pull candidate endpoints out of a source file: fetch('…'), axios.get('…'), url: '…'. */
function extractEndpoints(src) {
  const urls = new Set();
  // fetch('/api/x')  /  fetch(`/api/x`)
  for (const m of src.matchAll(/fetch\(\s*['"`]([^'"`]+)['"`]/g)) urls.add(m[1]);
  // axios.get('/api/x') / axios.post(...) / axios({ url: '/api/x' })
  for (const m of src.matchAll(/axios(?:\.\w+)?\(\s*['"`]([^'"`]+)['"`]/g)) urls.add(m[1]);
  for (const m of src.matchAll(/\burl:\s*['"`]([^'"`]+)['"`]/g)) urls.add(m[1]);
  // useSWR('/api/x') / useQuery(['x'], () => fetch('/api/x'))  — first string arg
  for (const m of src.matchAll(/useSWR\(\s*['"`]([^'"`]+)['"`]/g)) urls.add(m[1]);
  return [...urls].filter((u) => /^https?:\/\/|^\//.test(u)); // only real paths/URLs
}

/** MSW http verb for a detected method (defaults to get). */
const verb = (method) => (method ? method.toLowerCase() : 'get');

/** Convert template-literal interpolations in a URL to MSW path params:
 *  `/api/orders/${id}` -> `/api/orders/:id`; complex exprs -> `:pN`. */
function toMswPath(url) {
  let i = 0;
  return url.replace(/\$\{\s*([^}]*?)\s*\}/g, (_, expr) =>
    /^[A-Za-z_$][\w$]*$/.test(expr) ? `:${expr}` : `:p${i++}`
  );
}

/**
 * Build the shared handler stub set from every detected endpoint. Emits ONE
 * handler per endpoint (no endpoint×method cross-product, which produced
 * nonsensical verb/path pairs): use the file's method only when exactly one was
 * detected, else default to GET with a TODO.
 * Returns `null` when no endpoint could be located (caller then skips MSW).
 */
function buildHandlers(apiFiles, root) {
  const seen = new Set();
  const blocks = [];
  for (const api of apiFiles) {
    const abs = path.isAbsolute(api.file) ? api.file : path.join(root, api.file);
    let src = '';
    try { src = readFileSync(abs, 'utf8'); } catch { /* best effort */ }
    const method = api.methods?.length === 1 ? verb(api.methods[0]) : 'get';
    for (const url of extractEndpoints(src)) {
      const mswPath = toMswPath(url);
      const key = `${method} ${mswPath}`;
      if (seen.has(key)) continue; // de-dupe across files
      seen.add(key);
      blocks.push(
        `  // TODO: confirm method/shape — derived from ${path.relative(root, abs)}\n` +
        `  http.${method}('${mswPath}', () => {\n` +
        `    return HttpResponse.json({}); // TODO: return a realistic fixture\n` +
        `  }),`
      );
    }
  }
  return blocks.length ? blocks : null;
}

export function generateMswMocks(analysis) {
  const root = analysis.root ?? process.cwd();
  const apiFiles = (analysis.api ?? []).filter((a) => !MSW_INFRA_RE.test(a.file));
  if (!apiFiles.length) return { skipped: 'no application API files detected' };

  const handlerBlocks = buildHandlers(apiFiles, root);
  if (!handlerBlocks) return { skipped: 'API files found but no endpoint URLs could be located' };

  const files = [];

  // 1) Shared handlers + Node server (written once, marker-guarded so we never
  //    clobber a hand-edited handlers file).
  files.push({
    filename: 'src/test/msw/handlers.ts',
    content: `// ${GENERATED_MARKER} — MSW v2 request handlers (best-effort scaffold).
// MSW v2 uses the \`http\` namespace (not \`rest\`) and \`HttpResponse\`. Tests can
// override any of these at runtime with \`server.use(...)\` and reset in afterEach.
import { http, HttpResponse } from 'msw';

export const handlers = [
${handlerBlocks.join('\n')}
];
`,
  });

  files.push({
    filename: 'src/test/msw/server.ts',
    content: `// ${GENERATED_MARKER} — Node-side MSW server for the jsdom \`unit\` project.
// \`setupServer\` intercepts the global fetch at the Node layer, so hooks/modules
// are tested with zero network access. Start/stop it from src/test/setup.ts.
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
`,
  });

  // 2) One integration test per application API file.
  for (const api of apiFiles) {
    const base = path.basename(api.file).replace(/\.\w+$/, '');
    const dir = path.dirname(api.file); // e.g. src/api
    const importLine = `import * as api from './${base}';`;
    // Relative path from THIS test's dir to the fixed server location — correct
    // at any nesting depth (not just src/api one level down).
    let serverRel = path.relative(dir, path.join('src', 'test', 'msw', 'server')).split(path.sep).join('/');
    if (!serverRel.startsWith('.')) serverRel = './' + serverRel;
    files.push({
      filename: path.join(dir, `${base}.api.test.ts`),
      content: `// ${GENERATED_MARKER} — MSW integration test for ${api.file} (scaffold).
// Runs in the jsdom \`unit\` Vitest project. The MSW server is started by
// src/test/setup.ts; here we override handlers per-test to assert happy/error paths.
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '${serverRel}';
${importLine}

describe('${base} (API integration)', () => {
  it('exposes a callable surface', () => {
    expect(api).toBeDefined();
  });

  // Left as a TODO (not a vacuous green test) so it shows as pending until you
  // assert the module's real failure behaviour against a mocked error response.
  it.todo('surfaces an error when the request fails — e.g. server.use(http.get(URL, () => new HttpResponse(null, { status: 500 })))');
});
`,
    });
  }

  return { files };
}
