// platform/ai/analyze.mjs
// ---------------------------------------------------------------------------
// AI analysis module (Platform Feature #4). For each component it infers a
// purpose, the key behaviours, and the concrete tests that are still missing —
// using the Claude API when a key is present, and a deterministic heuristic
// otherwise so the command is always useful (and self-testable offline).
//
// Accuracy comes from grounding the model: we pass the scanner's REAL coverage
// (which states already have stories, whether a test file exists) so neither the
// heuristic nor Claude suggests tests that already exist.
// ---------------------------------------------------------------------------
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { findComponents } from '../../scripts/lib/stories.mjs';
import { analyzeComponent, statesFor } from '../generators/lib.mjs';
import { scan } from '../core/scan.mjs';
import { callClaude, DEFAULT_MODEL } from './client.mjs';

// Bump when the prompt or tool schema changes so cached results invalidate.
export const PROMPT_VERSION = 'v1';
const MAX_SOURCE_CHARS = 6000;

// --- structured-output contract --------------------------------------------
export const ANALYSIS_TOOL = {
  name: 'report_component_analysis',
  description:
    'Report the inferred purpose of a React component and the concrete tests it should have but is missing.',
  input_schema: {
    type: 'object',
    properties: {
      purpose: { type: 'string', description: 'One sentence: what this component is for.' },
      behaviors: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key user-facing behaviours a test suite should cover.',
      },
      missingTests: {
        type: 'array',
        description: 'Concrete tests that should exist but likely do not.',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            kind: { type: 'string', enum: ['unit', 'interaction', 'story', 'e2e', 'a11y', 'visual'] },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            rationale: { type: 'string' },
            outline: { type: 'string', description: 'A short arrange / act / assert sketch.' },
          },
          required: ['title', 'kind', 'priority'],
        },
      },
      edgeCases: { type: 'array', items: { type: 'string' } },
      a11yConcerns: { type: 'array', items: { type: 'string' } },
      overallRisk: { type: 'string', enum: ['low', 'medium', 'high'] },
    },
    required: ['purpose', 'behaviors', 'missingTests', 'overallRisk'],
  },
};

export const SYSTEM_PROMPT =
  'You are a senior frontend test engineer reviewing a React component. Infer what it does and ' +
  'identify the concrete, high-value tests it is missing. Be specific and practical: prefer ' +
  'behaviour and edge-case coverage over trivial render checks. The user gives you the scanner\'s ' +
  'coverage facts — do NOT suggest tests for states already listed as covered. Always answer via the provided tool.';

// A component's coverage as seen by the scanner. `defaultCoverage` is the
// worst-case used when no scanner data is supplied (e.g. a raw unit test).
export function defaultCoverage(model, component) {
  const applicable = statesFor(model).map((s) => s.name);
  return { applicable, covered: [], missing: applicable, hasStory: !!component?.hasStory, hasTest: false };
}

// --- prompt construction (pure) --------------------------------------------
/** A compact, model-friendly summary of the scanner's structural findings. */
export function structuralFacts(model, coverage) {
  return {
    name: model.name,
    file: model.file,
    exportStyle: model.importStyle,
    requiredProps: model.required.map((p) => `${p.name}: ${p.type}`),
    optionalProps: model.props.filter((p) => p.optional).map((p) => p.name),
    handlers: model.handlers.map((h) => h.name),
    renders: Object.entries(model.renders).filter(([, v]) => v).map(([k]) => k),
    coveredStates: coverage.covered,
    missingStates: coverage.missing,
    hasTestFile: coverage.hasTest,
  };
}

export function buildUserPrompt(component, model, coverage, { maxSourceChars = MAX_SOURCE_CHARS } = {}) {
  const facts = structuralFacts(model, coverage);
  const src = component.source.length > maxSourceChars
    ? component.source.slice(0, maxSourceChars) + '\n/* …truncated… */'
    : component.source;
  return [
    `Component: ${facts.name}  (${facts.file})`,
    `Scanner facts (JSON): ${JSON.stringify(facts)}`,
    `Already has a story: ${(coverage.hasStory ?? component.hasStory) ? 'yes' : 'no'} · has a test file: ${coverage.hasTest ? 'yes' : 'no'}`,
    '',
    'Source:',
    '```tsx',
    src,
    '```',
    '',
    'Report the purpose, key behaviours, and the missing tests worth writing (skip anything already covered).',
  ].join('\n');
}

// --- caching ----------------------------------------------------------------
export function hashFor(component, modelId, coverage) {
  // Include the coverage signature: the AI result depends on the coverage facts
  // in the prompt, so adding a story (coverage changes, source unchanged) must
  // invalidate the cached analysis.
  const covSig = coverage
    ? JSON.stringify({ c: coverage.covered, m: coverage.missing, t: coverage.hasTest, s: coverage.hasStory ?? component?.hasStory })
    : '';
  return createHash('sha256')
    .update(PROMPT_VERSION).update('\0').update(modelId).update('\0').update(covSig).update('\0').update(component.source)
    .digest('hex')
    .slice(0, 32);
}

/** A best-effort, file-backed cache. Failures (read-only FS) are swallowed. */
export function fileCache(dir) {
  return {
    get(key) {
      try {
        const f = path.join(dir, `${key}.json`);
        return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
      } catch { return null; }
    },
    set(key, value) {
      try {
        mkdirSync(dir, { recursive: true });
        writeFileSync(path.join(dir, `${key}.json`), JSON.stringify(value));
      } catch { /* best-effort */ }
    },
  };
}

const memoryCache = () => {
  const m = new Map();
  return { get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, v) };
};

// --- heuristic (offline) analyzer ------------------------------------------
function inferPurpose(model) {
  const r = model.renders;
  if (r.form) return `A form for collecting and submitting ${model.name.replace(/(Form|Card)$/, '').toLowerCase() || 'user'} input.`;
  if (r.input) return `An input control for user-entered data (${model.name}).`;
  if (r.button) return `A clickable button control (${model.name}).`;
  if (r.heading) return `A presentational component that displays ${model.name} content.`;
  return `A UI component named ${model.name}.`;
}

function heuristicBehaviors(model) {
  const out = [];
  for (const h of model.handlers) out.push(`Invokes \`${h.name}\` in response to user interaction.`);
  if (model.loadingProp) out.push('Shows a loading state while work is in flight.');
  if (model.disabledProp) out.push('Can be disabled to prevent interaction.');
  if (model.errorProp) out.push('Displays an error message when one is provided.');
  if (model.valueProp) out.push('Reflects its controlled value.');
  if (model.renders.form) out.push('Submits collected input and validates it.');
  if (out.length === 0) out.push(`Renders its ${model.required.length ? 'required props' : 'default'} content.`);
  return out;
}

/** Deterministic analysis from scanner facts — the no-key path and AI seed. */
export function heuristicAnalysis(component, model, coverage) {
  const missing = coverage.missing ?? [];
  const tests = [];

  for (const name of missing) {
    tests.push({
      title: `Renders the ${name} state`,
      kind: 'story',
      priority: name === 'Error' || name === 'Loading' ? 'high' : 'medium',
      rationale: `The ${name} state is expressible from this component's props but no story covers it.`,
    });
  }
  // Interaction assertions only when there is NO test file — if one exists we
  // can't see inside it, so we don't claim a handler is untested.
  if (!coverage.hasTest) {
    for (const h of model.handlers) {
      tests.push({
        title: `Calls ${h.name} on interaction`,
        kind: 'interaction',
        priority: 'high',
        rationale: `\`${h.name}\` is a handler prop and there is no test file; assert it fires (and its payload).`,
        outline: `render with a spy for ${h.name}; simulate the user action; expect(${h.name}).toHaveBeenCalled().`,
      });
    }
  }
  // a11y findings are structural (read from source), independent of test coverage.
  if (model.renders.input && !model.labelProp && !/aria-label|aria-labelledby|<label/i.test(component.source)) {
    tests.push({
      title: 'Input exposes an accessible name',
      kind: 'a11y',
      priority: 'high',
      rationale: 'A rendered input/select/textarea has no detected label, aria-label, or <label> — screen readers cannot name it.',
    });
  }
  if (model.errorProp && !/aria-describedby|role=\{?["']?alert/i.test(component.source)) {
    tests.push({
      title: 'Associates the error message with the field (aria-describedby / role=alert)',
      kind: 'a11y',
      priority: 'medium',
      rationale: 'Error text should be programmatically linked to its input so assistive tech announces it.',
    });
  }

  const edgeCases = [];
  const handlerNames = new Set(model.handlers.map((h) => h.name));
  for (const p of model.props) {
    const t = p.type.trim();
    // Skip handlers / function-typed props — a `(q: string) => void` arg is not a
    // string value that can "overflow".
    if (handlerNames.has(p.name) || /=>|\bFunction\b/.test(t)) continue;
    if (/\[\]\s*$/.test(t) || /^(readonly\s+)?(Array|ReadonlyArray)\s*</.test(t)) { edgeCases.push(`\`${p.name}\` is empty.`); continue; }
    // Object-ish types (Record/Map/Set/inline {}) contain 'string'/'number' in
    // their key/value types but are not scalars — don't flag them as overflow.
    if (/^(Record|Map|Set|Partial|Readonly|\{)/.test(t)) continue;
    if (/\bstring\b/.test(t)) edgeCases.push(`\`${p.name}\` is very long / overflows.`);
    else if (/\bnumber\b/.test(t)) edgeCases.push(`\`${p.name}\` is zero or negative.`);
  }

  const risk = !component.hasStory && !coverage.hasTest ? 'high' : missing.length ? 'medium' : 'low';
  return {
    purpose: inferPurpose(model),
    behaviors: heuristicBehaviors(model),
    missingTests: tests,
    edgeCases: [...new Set(edgeCases)].slice(0, 6),
    a11yConcerns: tests.filter((t) => t.kind === 'a11y').map((t) => t.title),
    overallRisk: risk,
    source: 'heuristic',
  };
}

// --- per-component + project orchestration ---------------------------------
async function mapPool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(size, items.length)) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Analyze one component. Uses the cache, then the API (when useAI && apiKey),
 * else the heuristic. `opts.coverage` supplies the scanner's real coverage; when
 * omitted a worst-case default is used.
 */
export async function analyzeOne(component, {
  apiKey,
  model: modelId = DEFAULT_MODEL,
  useAI = true,
  fetchImpl,
  cache = memoryCache(),
  coverage,
  retries,
  backoffMs,
  maxTokens,
} = {}) {
  const model = analyzeComponent(component);
  const cov = coverage ?? defaultCoverage(model, component);
  const base = { name: component.name, file: component.file };

  if (!(useAI && apiKey)) {
    return { ...base, ...heuristicAnalysis(component, model, cov), cached: false };
  }

  const key = hashFor(component, modelId, cov);
  const hit = cache.get(key);
  if (hit) return { ...base, ...hit, cached: true };

  try {
    const input = await callClaude({
      apiKey,
      model: modelId,
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(component, model, cov),
      tool: ANALYSIS_TOOL,
      fetchImpl,
      ...(retries !== undefined ? { retries } : {}),
      ...(backoffMs !== undefined ? { backoffMs } : {}),
      ...(maxTokens !== undefined ? { maxTokens } : {}),
    });
    const result = { ...input, source: 'ai', model: modelId };
    cache.set(key, result);
    return { ...base, ...result, cached: false };
  } catch (err) {
    // Never fail the whole run on one component — fall back to the heuristic.
    return {
      ...base,
      ...heuristicAnalysis(component, model, cov),
      source: 'heuristic-fallback',
      error: err instanceof Error ? err.message : String(err),
      cached: false,
    };
  }
}

/** Build a coverage lookup (keyed by relative file path) from a full scan. */
export function coverageIndex(scanResult) {
  const map = new Map();
  for (const c of scanResult.components ?? []) {
    map.set(c.file, {
      applicable: c.states?.applicable ?? [],
      covered: c.states?.covered ?? [],
      missing: c.states?.missing ?? [],
      hasStory: !!c.hasStory,
      hasTest: !!c.hasTest,
    });
  }
  return map;
}

/**
 * Analyze a project's components.
 *   analyzeProject(root, { apiKey, model, useAI, only, max, concurrency, cacheDir, cache, ignore, fetchImpl })
 */
export async function analyzeProject(root, opts = {}) {
  const srcRoot = existsSync(path.join(root, 'src')) ? path.join(root, 'src') : root;
  let components = findComponents([srcRoot], { ignore: opts.ignore ?? [] });
  if (opts.only) {
    const want = new Set(opts.only.map((s) => s.toLowerCase()));
    components = components.filter((c) => want.has(c.name.toLowerCase()));
  }
  if (opts.max && components.length > opts.max) components = components.slice(0, opts.max);

  // Real coverage from the scanner so suggestions exclude what already exists.
  const covIndex = coverageIndex(scan(root));

  const cache = opts.cache ?? (opts.cacheDir ? fileCache(opts.cacheDir) : memoryCache());
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const modelId = opts.model ?? process.env.FTAP_AI_MODEL ?? DEFAULT_MODEL;
  const useAI = opts.useAI !== false && !!apiKey;

  const analyses = await mapPool(components, opts.concurrency ?? 4, (c) => {
    const model = analyzeComponent(c);
    const coverage = covIndex.get(path.relative(root, c.file)) ?? defaultCoverage(model, c);
    return analyzeOne(c, { apiKey, model: modelId, useAI, fetchImpl: opts.fetchImpl, cache, coverage, maxTokens: opts.maxTokens });
  });

  return {
    root,
    model: useAI ? modelId : null,
    mode: useAI ? 'ai' : 'heuristic',
    componentCount: analyses.length,
    analyses,
  };
}

// --- "feed higher-quality generation" --------------------------------------
/** Flatten the analyses into a prioritised, generator-friendly checklist. */
export function toSuggestionList(projectAnalysis) {
  const rank = { high: 0, medium: 1, low: 2 };
  const items = [];
  for (const a of projectAnalysis.analyses) {
    for (const t of a.missingTests ?? []) {
      items.push({ component: a.name, file: a.file, ...t });
    }
  }
  return items.sort((x, y) => (rank[x.priority] ?? 9) - (rank[y.priority] ?? 9));
}

/** Render a Markdown report of the AI/heuristic analysis. */
export function toMarkdown(projectAnalysis) {
  const lines = [
    `# AI test-gap analysis`,
    ``,
    `Mode: **${projectAnalysis.mode}**${projectAnalysis.model ? ` · model \`${projectAnalysis.model}\`` : ''} · ${projectAnalysis.componentCount} component(s)`,
    ``,
  ];
  for (const a of projectAnalysis.analyses) {
    lines.push(`## ${a.name}  \`${a.file}\``);
    lines.push(`*${a.purpose}*  — risk: **${a.overallRisk}**`);
    if (a.behaviors?.length) {
      lines.push(``, `**Behaviours**`);
      for (const b of a.behaviors) lines.push(`- ${b}`);
    }
    if (a.missingTests?.length) {
      lines.push(``, `**Missing tests**`);
      for (const t of a.missingTests) {
        lines.push(`- [ ] _(${t.kind}, ${t.priority})_ ${t.title}${t.rationale ? ` — ${t.rationale}` : ''}`);
      }
    } else {
      lines.push(``, `_No missing tests detected._`);
    }
    if (a.edgeCases?.length) lines.push(``, `**Edge cases:** ${a.edgeCases.join('; ')}`);
    lines.push(``);
  }
  return lines.join('\n');
}
