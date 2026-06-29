// platform/generators/lib.mjs
// ---------------------------------------------------------------------------
// Shared analysis used by every Phase-2 generator. Turns a component
// descriptor (from findComponents) into a structured model: classified props,
// the states it can actually express, its handlers, and what it renders — so
// each generator emits artifacts that are correct for THAT component.
// ---------------------------------------------------------------------------
import { parseProps } from '../../scripts/lib/stories.mjs';

export const LONG_TEXT =
  'This is intentionally long content used to verify how the component handles wrapping, truncation and vertical growth across multiple lines of text';

const titleCase = (s) => s.replace(/^[a-z]/, (c) => c.toUpperCase());

const isHandler = (p) => /^on[A-Z]/.test(p.name) && /=>/.test(p.type);
const isBool = (p) => /\bboolean\b/.test(p.type);
const isString = (p) => /\bstring\b/.test(p.type) && !/\|/.test(p.type);
const isReactNode = (p) => /ReactNode|ReactElement|JSX\.Element/.test(p.type);
const find = (props, re, pred) => props.find((p) => re.test(p.name) && (!pred || pred(p)));

/** A literal JS expression that satisfies a prop's type (for args/JSX). */
export function exprForProp(p, componentName) {
  const t = p.type;
  if (isHandler(p)) return { expr: 'fn()', needsFn: true };
  // Function types (render-prop children, non-on* callbacks) BEFORE ReactNode,
  // since a render-prop's type string can itself contain "ReactNode".
  if (/=>/.test(t) || /\bFunction\b/.test(t)) return { expr: '() => undefined' };
  const lit = t.match(/'([^']*)'/);
  if (/\|/.test(t) && lit) return { expr: `'${lit[1]}'` }; // string-literal union
  if (isReactNode(p)) return { expr: `'${componentName}'` };
  if (/\[\]\s*$/.test(t) || /^(readonly\s+)?(Array|ReadonlyArray)\s*</.test(t)) return { expr: '[]' };
  if (/^(Record|Map|Partial|Readonly|\{)/.test(t)) return { expr: '{}' };
  if (/\bstring\b/.test(t)) return { expr: `'${titleCase(p.name)}'` };
  if (/\bnumber\b/.test(t)) return { expr: '0' };
  if (/\bboolean\b/.test(t)) return { expr: 'false' };
  if (lit) return { expr: `'${lit[1]}'` };
  return { expr: 'null as never', todo: true }; // typechecks anywhere; flagged for review
}

// --- shared flow detection/extraction (used by E2E + BDD generators) --------
export const SUBMIT_HANDLERS = /^(onSubmit|onSubscribe|onSave|onLogin|onSignup|onSearch)$/;

export function isFlowComponent(model) {
  return model.renders.form || model.handlers.some((h) => SUBMIT_HANDLERS.test(h.name));
}

/** Locate the first form field label + submit text from a component's JSX source. */
export function extractFlow(source) {
  const label =
    // a `label="..."` attribute — anchored so it never matches `aria-label=`
    source.match(/(?:^|\s)label=["']([^"']+)["']/)?.[1] ??
    // a native <label>text</label> element
    source.match(/<label[^>]*>\s*([^<{][^<{]*?)\s*(?:<|\{)/)?.[1]?.trim() ??
    // last resort: an aria-label
    source.match(/aria-label=["']([^"']+)["']/)?.[1] ??
    null;
  const isEmail = /type=["']email["']/.test(source);
  const submit =
    source.match(/type=["']submit["'][^>]*>\s*([^<\n]+?)\s*</)?.[1]?.trim() ??
    source.match(/<[A-Za-z]*[Bb]utton[^>]*type=["']submit["'][\s\S]*?>\s*([^<\n]+?)\s*</)?.[1]?.trim() ??
    'Submit';
  return { label, isEmail, submit };
}

/**
 * Build the rich model a generator needs.
 * `c` is a findComponents() result: { name, file, dir, exportType, source, ... }
 */
export function analyzeComponent(c) {
  const props = parseProps(c.source, c.name);
  const src = c.source;

  const handlers = props.filter(isHandler).map((p) => {
    const arg = p.type.match(/\(\s*(\w+)\s*:\s*([^)]+)\)/); // (value: string) => void
    return { ...p, argName: arg?.[1] ?? null, argType: arg?.[2]?.trim() ?? null };
  });

  const model = {
    name: c.name,
    file: c.file,
    dir: c.dir,
    importStyle: c.exportType === 'default' ? 'default' : 'named',
    props,
    required: props.filter((p) => !p.optional),
    handlers,
    loadingProp: find(props, /^(loading|isLoading|busy)$/, isBool),
    disabledProp: find(props, /^(disabled|isDisabled)$/, isBool),
    errorProp: find(props, /^(error|errorMessage|errorText)$/, isString),
    valueProp: find(props, /^value$/),
    contentProp: find(props, /^(children|items|data|rows|options)$/),
    textProp:
      props.find((p) => p.name === 'children' && (isReactNode(p) || isString(p))) ||
      find(props, /^(label|title|description)$/, isString),
    labelProp: find(props, /^label$/, isString),
    titleProp: find(props, /^title$/, isString),
    // What the component's own JSX renders (for choosing RTL queries / E2E selectors).
    renders: {
      button: /<button[\s>]/.test(src),
      input: /<(input|textarea|select)[\s>]/.test(src),
      heading: /<h[1-6][\s>]/.test(src),
      form: /<form[\s>]/.test(src),
    },
  };

  // Base args needed for the component to render (required props -> placeholders).
  model.requiredArgs = {};
  model.needsFn = false;
  for (const p of model.required) {
    const { expr, needsFn } = exprForProp(p, model.name);
    if (needsFn) model.needsFn = true;
    model.requiredArgs[p.name] = expr;
  }
  // Every handler becomes a spy in meta.args so interactions can be asserted.
  for (const h of model.handlers) {
    model.requiredArgs[h.name] = 'fn()';
    model.needsFn = true;
  }
  return model;
}

/** Default-story args: required args, or sensible samples when all props are optional. */
export function defaultArgs(model) {
  const args = {};
  for (const p of model.required) {
    const { expr } = exprForProp(p, model.name);
    args[p.name] = expr;
  }
  if (Object.keys(args).length === 0) {
    // All-optional component (e.g. Card): populate a few content props so the
    // Default story actually shows something distinct from an Empty story.
    const samples = { children: `'Content'`, title: `'${model.name}'`, label: `'Label'`, description: `'A short supporting description.'` };
    for (const p of model.props) if (samples[p.name]) args[p.name] = samples[p.name];
  }
  return args;
}

/** Serialize an args object whose values are raw JS expression strings. */
export function serializeArgs(obj, indent = '    ') {
  const keys = Object.keys(obj);
  if (keys.length === 0) return '{}';
  const inner = keys.map((k) => `${indent}${k}: ${obj[k]},`).join('\n');
  return `{\n${inner}\n${indent.slice(0, -2)}}`;
}

/** The story states a component can actually express, in display order. */
export function statesFor(model) {
  const states = [{ name: 'Default', args: defaultArgs(model) }];

  if (model.loadingProp) states.push({ name: 'Loading', args: { ...model.requiredArgs, [model.loadingProp.name]: 'true' } });
  if (model.disabledProp) states.push({ name: 'Disabled', args: { ...model.requiredArgs, [model.disabledProp.name]: 'true' } });
  if (model.errorProp) {
    const a = { ...model.requiredArgs, [model.errorProp.name]: `'Please enter a valid value.'` };
    if (model.valueProp) a[model.valueProp.name] = `'invalid'`;
    states.push({ name: 'Error', args: a });
  }
  // Empty only makes sense when the content prop is optional and nothing else is required.
  if (model.contentProp?.optional && model.required.length === 0) {
    states.push({ name: 'Empty', args: {} });
  }
  // Dark + Mobile are universally valid (rendered on a dark canvas / small viewport).
  states.push({ name: 'Dark', args: defaultArgs(model), dark: true });
  states.push({ name: 'Mobile', args: defaultArgs(model), mobile: true });
  if (model.textProp) {
    states.push({ name: 'Long', args: { ...defaultArgs(model), [model.textProp.name]: `'${LONG_TEXT}'` } });
  }
  return states;
}

export { isHandler, isBool, isString, isReactNode };
