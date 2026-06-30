// platform/ai/client.mjs
// ---------------------------------------------------------------------------
// Minimal, dependency-free Anthropic Messages API client. Uses *forced tool
// use* so the model must return structured JSON (the tool's input) rather than
// prose we'd have to parse. `fetch` is injectable so the analyzer is fully
// testable offline (and the whole module degrades to a heuristic with no key).
// ---------------------------------------------------------------------------

export const API_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';
// Balanced default for batch analysis; override with --model / FTAP_AI_MODEL.
// Opus (claude-opus-4-8) is available when you want maximum depth.
export const DEFAULT_MODEL = 'claude-sonnet-4-6';
// Headroom for the analysis schema (purpose + behaviors + missingTests objects).
// Too low risks a `stop_reason: max_tokens` truncation of the forced tool call.
export const DEFAULT_MAX_TOKENS = 4096;

const RETRYABLE = new Set([429, 500, 502, 503, 529]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Build a Messages API request body that forces a single tool call. Pure. */
export function requestBody({ model, system, user, tool, maxTokens = DEFAULT_MAX_TOKENS }) {
  return {
    model,
    max_tokens: maxTokens,
    system,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [{ role: 'user', content: user }],
  };
}

/**
 * Pull the forced tool's `input` out of a Messages API response. Pure.
 * Rejects truncated (stop_reason: max_tokens), empty, or required-key-missing
 * inputs so the caller can fall back rather than cache a stub analysis.
 */
export function extractToolInput(apiJson, toolName, requiredKeys = []) {
  const blocks = Array.isArray(apiJson?.content) ? apiJson.content : [];
  const call = blocks.find((b) => b?.type === 'tool_use' && b?.name === toolName);
  const truncated = apiJson?.stop_reason === 'max_tokens';

  if (call && call.input && typeof call.input === 'object' && !Array.isArray(call.input)) {
    const keys = Object.keys(call.input);
    const missing = requiredKeys.filter((k) => !(k in call.input));
    if (keys.length > 0 && missing.length === 0 && !truncated) return call.input;
    const why = truncated
      ? 'response truncated (stop_reason: max_tokens) — raise --max-tokens'
      : keys.length === 0
        ? 'empty tool input'
        : `tool input missing required keys: ${missing.join(', ')}`;
    throw new Error(`Incomplete "${toolName}" tool call — ${why}`);
  }
  // Surface whatever text came back so the failure is debuggable.
  const text = blocks.filter((b) => b?.type === 'text').map((b) => b.text).join(' ').trim();
  throw new Error(
    `Model did not return the "${toolName}" tool call` +
      (apiJson?.stop_reason ? ` (stop_reason: ${apiJson.stop_reason})` : '') +
      (text ? `: ${text.slice(0, 300)}` : '')
  );
}

/**
 * Call the API and return the structured tool input.
 *   callClaude({ apiKey, model, system, user, tool, fetchImpl, retries })
 * `fetchImpl` defaults to global fetch; tests inject a fake.
 */
export async function callClaude({
  apiKey,
  model = DEFAULT_MODEL,
  system,
  user,
  tool,
  maxTokens = DEFAULT_MAX_TOKENS,
  fetchImpl = globalThis.fetch,
  retries = 3,
  backoffMs = 500,
}) {
  if (!apiKey) throw new Error('No API key provided (set ANTHROPIC_API_KEY).');
  if (typeof fetchImpl !== 'function') throw new Error('fetch is not available in this runtime.');

  const body = requestBody({ model, system, user, tool, maxTokens });
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res;
    try {
      res = await fetchImpl(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      lastErr = err; // network blip — retryable
      if (attempt < retries) { await sleep(backoffMs * 2 ** attempt); continue; }
      throw err;
    }

    if (res.ok) {
      // A 2xx can still carry a non-JSON / truncated body (proxy error page,
      // cut connection). Treat a parse failure as a clear, non-retried error.
      let json;
      try {
        json = await res.json();
      } catch {
        throw new Error('Anthropic API returned a 2xx with a malformed JSON body.');
      }
      return extractToolInput(json, tool.name, tool.input_schema?.required ?? []);
    }

    const detail = await res.text().catch(() => '');
    if (RETRYABLE.has(res.status) && attempt < retries) {
      lastErr = new Error(`HTTP ${res.status}: ${detail.slice(0, 200)}`);
      await sleep(backoffMs * 2 ** attempt);
      continue;
    }
    throw new Error(`Anthropic API error ${res.status}: ${detail.slice(0, 300)}`);
  }
  throw lastErr ?? new Error('callClaude: exhausted retries');
}
