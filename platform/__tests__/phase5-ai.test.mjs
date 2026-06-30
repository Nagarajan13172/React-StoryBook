// platform/__tests__/phase5-ai.test.mjs
// Phase 5 — AI analysis module. All network is injected (fake fetch), so these
// run offline with no API key and never spend tokens.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { requestBody, extractToolInput, callClaude, API_URL, DEFAULT_MODEL, DEFAULT_MAX_TOKENS } from '../ai/client.mjs';
import {
  ANALYSIS_TOOL,
  buildUserPrompt,
  heuristicAnalysis,
  analyzeOne,
  analyzeProject,
  hashFor,
  toSuggestionList,
  toMarkdown,
  defaultCoverage,
} from '../ai/analyze.mjs';
import { analyzeComponent } from '../generators/lib.mjs';

// --- fixtures ---------------------------------------------------------------
const BUTTON_SRC = `
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}
export function Button({ children, onClick, disabled }: ButtonProps) {
  return <button onClick={onClick} disabled={disabled}>{children}</button>;
}
`;
const buttonComponent = {
  name: 'Button', file: 'src/Button.tsx', dir: 'src', exportType: 'named',
  source: BUTTON_SRC, hasStory: false,
};

const INPUT_SRC = `
interface FieldProps { value: string; onChange: (v: string) => void; }
export function Field({ value, onChange }: FieldProps) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} />;
}
`;
const fieldComponent = {
  name: 'Field', file: 'src/Field.tsx', dir: 'src', exportType: 'named',
  source: INPUT_SRC, hasStory: false,
};

// A fake fetch returning queued Response-likes; records calls.
function fakeFetch(queue) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const next = queue.shift();
    if (typeof next === 'function') return next();
    return next;
  };
  fn.calls = calls;
  return fn;
}
const okResponse = (input) => ({
  ok: true, status: 200,
  json: async () => ({ content: [{ type: 'tool_use', name: ANALYSIS_TOOL.name, input }] }),
  text: async () => '',
});
const errResponse = (status, body = '') => ({
  ok: false, status, json: async () => ({}), text: async () => body,
});
const SAMPLE_INPUT = { purpose: 'p', behaviors: ['b'], missingTests: [], overallRisk: 'low' };

// --- client: pure builders --------------------------------------------------
test('requestBody forces the tool call and carries system + user', () => {
  const body = requestBody({ model: 'm', system: 'sys', user: 'usr', tool: ANALYSIS_TOOL });
  assert.equal(body.model, 'm');
  assert.equal(body.system, 'sys');
  assert.deepEqual(body.tool_choice, { type: 'tool', name: ANALYSIS_TOOL.name });
  assert.equal(body.tools[0].name, ANALYSIS_TOOL.name);
  assert.equal(body.messages[0].content, 'usr');
});

test('extractToolInput returns the matching tool input, throws otherwise', () => {
  const ok = { content: [{ type: 'tool_use', name: ANALYSIS_TOOL.name, input: { x: 1 } }] };
  assert.deepEqual(extractToolInput(ok, ANALYSIS_TOOL.name), { x: 1 });
  const noTool = { content: [{ type: 'text', text: 'I refuse' }], stop_reason: 'end_turn' };
  assert.throws(() => extractToolInput(noTool, ANALYSIS_TOOL.name), /did not return.*tool call/i);
});

test('extractToolInput rejects truncation, empty input, and missing required keys', () => {
  const tool = ANALYSIS_TOOL.name;
  const req = ANALYSIS_TOOL.input_schema.required;
  const full = { purpose: 'p', behaviors: [], missingTests: [], overallRisk: 'low' };

  // truncated (stop_reason: max_tokens) even with a full input → reject
  const truncated = { content: [{ type: 'tool_use', name: tool, input: full }], stop_reason: 'max_tokens' };
  assert.throws(() => extractToolInput(truncated, tool, req), /truncated|max_tokens/i);

  // empty object → reject
  const empty = { content: [{ type: 'tool_use', name: tool, input: {} }] };
  assert.throws(() => extractToolInput(empty, tool, req), /empty/i);

  // missing required keys → reject (and name them)
  const partial = { content: [{ type: 'tool_use', name: tool, input: { purpose: 'p' } }] };
  assert.throws(() => extractToolInput(partial, tool, req), /missing required keys/i);

  // a complete, untruncated input → accepted
  const good = { content: [{ type: 'tool_use', name: tool, input: full }] };
  assert.deepEqual(extractToolInput(good, tool, req), full);
});

// --- client: network (injected) --------------------------------------------
test('callClaude posts to the API with auth headers and returns the tool input', async () => {
  const f = fakeFetch([okResponse(SAMPLE_INPUT)]);
  const out = await callClaude({ apiKey: 'sk-test', system: 's', user: 'u', tool: ANALYSIS_TOOL, fetchImpl: f });
  assert.deepEqual(out, SAMPLE_INPUT);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, API_URL);
  assert.equal(f.calls[0].init.headers['x-api-key'], 'sk-test');
  assert.ok(f.calls[0].init.headers['anthropic-version']);
});

test('callClaude retries on 429 then succeeds', async () => {
  const f = fakeFetch([errResponse(429, 'slow down'), okResponse(SAMPLE_INPUT)]);
  const out = await callClaude({ apiKey: 'k', system: 's', user: 'u', tool: ANALYSIS_TOOL, fetchImpl: f, backoffMs: 1 });
  assert.deepEqual(out, SAMPLE_INPUT);
  assert.equal(f.calls.length, 2);
});

test('callClaude throws on a non-retryable 400', async () => {
  const f = fakeFetch([errResponse(400, 'bad request')]);
  await assert.rejects(
    () => callClaude({ apiKey: 'k', system: 's', user: 'u', tool: ANALYSIS_TOOL, fetchImpl: f, retries: 0 }),
    /400/,
  );
});

test('callClaude requires an API key', async () => {
  await assert.rejects(
    () => callClaude({ system: 's', user: 'u', tool: ANALYSIS_TOOL, fetchImpl: fakeFetch([]) }),
    /API key/i,
  );
});

test('callClaude throws a clear error on a 2xx with a malformed JSON body', async () => {
  const badBody = { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); }, text: async () => '<html>' };
  await assert.rejects(
    () => callClaude({ apiKey: 'k', system: 's', user: 'u', tool: ANALYSIS_TOOL, fetchImpl: fakeFetch([badBody]), retries: 0 }),
    /malformed JSON/i,
  );
});

// --- heuristic analyzer -----------------------------------------------------
test('heuristic flags missing states + interaction (no test file) + high risk', () => {
  const model = analyzeComponent(buttonComponent);
  const coverage = { applicable: ['Default', 'Disabled'], covered: ['Default'], missing: ['Disabled'], hasStory: false, hasTest: false };
  const a = heuristicAnalysis(buttonComponent, model, coverage);
  const titles = a.missingTests.map((t) => t.title);
  assert.ok(titles.some((t) => /Disabled state/.test(t)), 'suggests the missing Disabled story');
  assert.ok(titles.some((t) => /Calls onClick/.test(t)), 'suggests asserting onClick');
  assert.equal(a.overallRisk, 'high'); // no story AND no test
  assert.match(a.purpose, /button/i);
});

test('heuristic does NOT suggest interaction tests when a test file exists', () => {
  const model = analyzeComponent(buttonComponent);
  const coverage = { applicable: ['Default'], covered: ['Default'], missing: [], hasStory: true, hasTest: true };
  const a = heuristicAnalysis(buttonComponent, model, coverage);
  assert.ok(!a.missingTests.some((t) => /Calls onClick/.test(t.title)), 'no interaction claim when a test file is present');
  assert.equal(a.overallRisk, 'low');
});

test('heuristic flags an unlabelled input as an a11y gap', () => {
  const model = analyzeComponent(fieldComponent);
  const a = heuristicAnalysis(fieldComponent, model, { missing: [], hasTest: true, hasStory: true });
  assert.ok(a.missingTests.some((t) => t.kind === 'a11y' && /accessible name/i.test(t.title)));
});

test('heuristic does NOT flag Record/object props as string-overflow edge cases', () => {
  const src = `
interface WidgetProps { meta?: Record<string, number>; label: string; }
export function Widget({ meta, label }: WidgetProps) { return <div>{label}</div>; }
`;
  const comp = { name: 'Widget', file: 'src/Widget.tsx', dir: 'src', exportType: 'named', source: src, hasStory: true };
  const a = heuristicAnalysis(comp, analyzeComponent(comp), { missing: [], hasTest: true, hasStory: true });
  assert.ok(a.edgeCases.some((e) => /label/.test(e)), 'string prop still flagged');
  assert.ok(!a.edgeCases.some((e) => /meta/.test(e)), 'Record prop is not flagged as overflow');
});

test('heuristic a11y recognizes the JSX-expression role={\'alert\'} form (no false positive)', () => {
  const src = `
interface AlertProps { error?: string; }
export function Alert({ error }: AlertProps) { return error ? <div role={'alert'}>{error}</div> : null; }
`;
  const comp = { name: 'Alert', file: 'src/Alert.tsx', dir: 'src', exportType: 'named', source: src, hasStory: true };
  const a = heuristicAnalysis(comp, analyzeComponent(comp), { missing: [], hasTest: true, hasStory: true });
  assert.ok(!a.missingTests.some((t) => /Associates the error message/.test(t.title)),
    'role={\'alert\'} is recognized as an alert role');
});

// --- analyzeOne: AI path, caching, fallback --------------------------------
test('analyzeOne (AI) returns the model output and caches it (one fetch for two calls)', async () => {
  const f = fakeFetch([okResponse({ ...SAMPLE_INPUT, purpose: 'from-ai' })]);
  const cache = (() => { const m = new Map(); return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v) }; })();
  const opts = { apiKey: 'k', useAI: true, fetchImpl: f, cache, coverage: { missing: [], hasTest: true } };

  const first = await analyzeOne(buttonComponent, opts);
  assert.equal(first.source, 'ai');
  assert.equal(first.purpose, 'from-ai');
  assert.equal(first.cached, false);

  const second = await analyzeOne(buttonComponent, opts);
  assert.equal(second.cached, true);
  assert.equal(f.calls.length, 1, 'second call served from cache');
});

test('analyzeOne falls back to the heuristic when the API errors', async () => {
  const f = fakeFetch([errResponse(500, 'boom')]);
  const a = await analyzeOne(buttonComponent, {
    apiKey: 'k', useAI: true, fetchImpl: f, retries: 0,
    cache: { get: () => null, set: () => {} },
    coverage: { missing: ['Disabled'], hasTest: false },
  });
  assert.equal(a.source, 'heuristic-fallback');
  assert.ok(a.error, 'records the API error');
  assert.ok(a.missingTests.length > 0);
});

test('analyzeOne without a key uses the heuristic and never calls fetch', async () => {
  const f = fakeFetch([]);
  const a = await analyzeOne(buttonComponent, { useAI: true, fetchImpl: f, coverage: { missing: [], hasTest: true } });
  assert.equal(a.source, 'heuristic');
  assert.equal(f.calls.length, 0);
});

// --- hashing + prompt + aggregation ----------------------------------------
test('hashFor is stable for the same source and differs when source changes', () => {
  const h1 = hashFor(buttonComponent, DEFAULT_MODEL);
  const h2 = hashFor(buttonComponent, DEFAULT_MODEL);
  const h3 = hashFor({ ...buttonComponent, source: BUTTON_SRC + '\n// changed' }, DEFAULT_MODEL);
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
});

test('hashFor invalidates when coverage (added story / states) changes', () => {
  const before = { covered: [], missing: ['Loading'], hasTest: false, hasStory: false };
  const afterStory = { covered: ['Default'], missing: [], hasTest: false, hasStory: true };
  const h1 = hashFor(buttonComponent, DEFAULT_MODEL, before);
  const h2 = hashFor(buttonComponent, DEFAULT_MODEL, afterStory);
  assert.notEqual(h1, h2, 'a coverage/story change must bust the cache');
});

test('requestBody uses the default token cap and honours an override', () => {
  assert.equal(requestBody({ model: 'm', system: 's', user: 'u', tool: ANALYSIS_TOOL }).max_tokens, DEFAULT_MAX_TOKENS);
  assert.ok(DEFAULT_MAX_TOKENS >= 4096);
  assert.equal(requestBody({ model: 'm', system: 's', user: 'u', tool: ANALYSIS_TOOL, maxTokens: 8000 }).max_tokens, 8000);
});

test('analyzeOne forwards maxTokens through to the API request', async () => {
  const f = fakeFetch([okResponse(SAMPLE_INPUT)]);
  await analyzeOne(buttonComponent, {
    apiKey: 'k', useAI: true, fetchImpl: f, maxTokens: 7777,
    cache: { get: () => null, set: () => {} }, coverage: { missing: [], hasTest: true },
  });
  const body = JSON.parse(f.calls[0].init.body);
  assert.equal(body.max_tokens, 7777);
});

test('buildUserPrompt includes coverage facts and the source', () => {
  const model = analyzeComponent(buttonComponent);
  const prompt = buildUserPrompt(buttonComponent, model, { covered: ['Default'], missing: ['Disabled'], hasTest: false });
  assert.match(prompt, /missingStates/);
  assert.match(prompt, /Disabled/);
  assert.match(prompt, /export function Button/);
});

test('buildUserPrompt truncates very long sources', () => {
  const big = { ...buttonComponent, source: 'x'.repeat(20000) };
  const model = analyzeComponent(buttonComponent);
  const prompt = buildUserPrompt(big, model, { covered: [], missing: [], hasTest: false }, { maxSourceChars: 100 });
  assert.match(prompt, /truncated/);
  assert.ok(prompt.length < 2000);
});

test('toSuggestionList flattens and sorts by priority', () => {
  const project = {
    analyses: [
      { name: 'A', file: 'a', missingTests: [{ title: 'low one', kind: 'story', priority: 'low' }] },
      { name: 'B', file: 'b', missingTests: [{ title: 'high one', kind: 'unit', priority: 'high' }] },
    ],
  };
  const list = toSuggestionList(project);
  assert.equal(list.length, 2);
  assert.equal(list[0].priority, 'high');
  assert.equal(list[0].component, 'B');
});

test('toMarkdown renders purpose, risk and a checklist', () => {
  const md = toMarkdown({
    mode: 'heuristic', model: null, componentCount: 1,
    analyses: [{ name: 'Button', file: 'src/Button.tsx', purpose: 'A button.', overallRisk: 'high',
      behaviors: ['clicks'], missingTests: [{ title: 'Calls onClick', kind: 'interaction', priority: 'high' }] }],
  });
  assert.match(md, /# AI test-gap analysis/);
  assert.match(md, /## Button/);
  assert.match(md, /- \[ \] _\(interaction, high\)_ Calls onClick/);
});

// --- integration: heuristic project run over the demo app -------------------
test('analyzeProject (heuristic) covers every component with a purpose and risk', async () => {
  const result = await analyzeProject(process.cwd(), { useAI: false });
  assert.equal(result.mode, 'heuristic');
  assert.ok(result.componentCount >= 1);
  for (const a of result.analyses) {
    assert.ok(a.purpose, `${a.name} has a purpose`);
    assert.ok(['low', 'medium', 'high'].includes(a.overallRisk));
    assert.ok(Array.isArray(a.missingTests));
  }
});

test('defaultCoverage marks all applicable states as missing (worst case)', () => {
  const model = analyzeComponent(buttonComponent);
  const cov = defaultCoverage(model, buttonComponent);
  assert.deepEqual(cov.covered, []);
  assert.deepEqual(cov.missing, cov.applicable);
  assert.ok(cov.applicable.includes('Default'));
});
