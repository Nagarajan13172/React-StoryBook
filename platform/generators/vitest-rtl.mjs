// platform/generators/vitest-rtl.mjs
// ---------------------------------------------------------------------------
// Emits <Name>.test.tsx — React Testing Library unit tests that run node-side
// in the jsdom `unit` Vitest project (separate from the browser storybook
// project). Generates a render smoke test plus interaction tests derived from
// the component's handlers and what it renders.
// ---------------------------------------------------------------------------
import { GENERATED_MARKER } from '../../scripts/lib/stories.mjs';
import { analyzeComponent, defaultArgs } from './lib.mjs';

const unquote = (expr) => (/^'.*'$/.test(expr) ? expr.slice(1, -1) : expr);
// A short, regex-safe accessible-name fragment from a string expression.
const nameRe = (expr) => {
  const text = unquote(expr).split(/\s+/).slice(0, 3).join(' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `/${text}/i`;
};

/** Build a JSX element string for the component from an args map (expr values). */
function renderJsx(model, args, spies = {}) {
  const attrs = [];
  let child = null;
  for (const [key, expr] of Object.entries(args)) {
    if (key === 'children') {
      child = /^'.*'$/.test(expr) ? unquote(expr) : `{${expr}}`;
      continue;
    }
    if (spies[key]) attrs.push(`${key}={${spies[key]}}`);
    else if (expr === 'true') attrs.push(key);
    else if (/^'.*'$/.test(expr)) attrs.push(`${key}="${unquote(expr)}"`);
    else attrs.push(`${key}={${expr}}`);
  }
  const open = `<${model.name}${attrs.length ? ' ' + attrs.join(' ') : ''}`;
  return child === null ? `${open} />` : `${open}>${child}</${model.name}>`;
}

/** The accessible query that proves the component rendered. Buttons use a
 *  role query (never `container`) so icon-only buttons work too. */
function smokeQuery(model, args) {
  if (model.renders.button) {
    const named = args.children ? `, { name: ${nameRe(args.children)} }` : '';
    return { q: `screen.getByRole('button'${named})`, container: false };
  }
  if (model.renders.input && model.labelProp && args[model.labelProp.name]) return { q: `screen.getByLabelText(${args[model.labelProp.name]})`, container: false };
  if (model.renders.heading && model.titleProp && args[model.titleProp.name]) return { q: `screen.getByRole('heading', { name: ${nameRe(args[model.titleProp.name])} })`, container: false };
  return { q: `container.firstChild`, container: true };
}

export function generateUnitTest(component) {
  const model = analyzeComponent(component);
  const { name, importStyle } = model;
  const importLine = importStyle === 'default' ? `import ${name} from './${name}';` : `import { ${name} } from './${name}';`;

  const dArgs = defaultArgs(model);
  const onClick = model.handlers.find((h) => h.name === 'onClick');
  const onChange = model.handlers.find((h) => h.name === 'onChange');
  const valueRequired = model.valueProp && !model.valueProp.optional;

  const tests = [];
  let usesUser = false;
  let usesVi = false;

  // Render the component, turning any required handler arg (`fn()`) into a real
  // vi.fn() spy — so we never emit an unimported `fn` reference.
  const spyify = (args, extra = {}) => {
    const merged = { ...args, ...extra };
    const handlerKeys = Object.keys(merged).filter((k) => merged[k] === 'fn()');
    if (handlerKeys.length) usesVi = true;
    const decls = handlerKeys.map((k) => `    const ${k} = vi.fn();`);
    const spies = Object.fromEntries(handlerKeys.map((k) => [k, k]));
    return { decls, jsx: renderJsx(model, merged, spies) };
  };

  // 1) Smoke render
  const smoke = smokeQuery(model, dArgs);
  const s = spyify(dArgs);
  const renderStmt = smoke.container ? `const { container } = render(${s.jsx});` : `render(${s.jsx});`;
  tests.push([`  it('renders without crashing', () => {`, ...s.decls, `    ${renderStmt}`, `    expect(${smoke.q}).toBeTruthy();`, `  });`].join('\n'));

  // A role-based click target that never depends on `container`.
  const buttonTarget = `screen.getByRole('button'${dArgs.children ? `, { name: ${nameRe(dArgs.children)} }` : ''})`;

  // 2) onClick fires (clickable component)
  if (onClick && model.renders.button) {
    usesUser = usesVi = true;
    const r = spyify(dArgs, { onClick: 'fn()' });
    tests.push([`  it('fires onClick when clicked', async () => {`, `    const user = userEvent.setup();`, ...r.decls, `    render(${r.jsx});`, `    await user.click(${buttonTarget});`, `    expect(onClick).toHaveBeenCalledTimes(1);`, `  });`].join('\n'));

    if (model.loadingProp) {
      const r2 = spyify(dArgs, { [model.loadingProp.name]: 'true', onClick: 'fn()' });
      tests.push([`  it('does not fire onClick while ${model.loadingProp.name} (button is inert)', async () => {`, `    const user = userEvent.setup();`, ...r2.decls, `    render(${r2.jsx});`, `    const button = ${buttonTarget};`, `    expect(button).toBeDisabled();`, `    await user.click(button);`, `    expect(onClick).not.toHaveBeenCalled();`, `  });`].join('\n'));
    }
    if (model.disabledProp) {
      const r3 = spyify(dArgs, { [model.disabledProp.name]: 'true', onClick: 'fn()' });
      tests.push([`  it('does not fire onClick when ${model.disabledProp.name}', async () => {`, `    const user = userEvent.setup();`, ...r3.decls, `    render(${r3.jsx});`, `    await user.click(${buttonTarget});`, `    expect(onClick).not.toHaveBeenCalled();`, `  });`].join('\n'));
    }
  }

  // 3) onChange fires (text input) — render UNCONTROLLED to avoid the value-prop
  //    trap. Skip when `value` is REQUIRED (can't omit it without a type error).
  if (onChange && model.renders.input && model.labelProp && !valueRequired) {
    usesUser = usesVi = true;
    const label = dArgs[model.labelProp.name] ?? `'Label'`;
    const jsx = renderJsx(model, { [model.labelProp.name]: label, onChange: 'fn()' }, { onChange: 'onChange' });
    tests.push([`  it('calls onChange as the user types', async () => {`, `    const user = userEvent.setup();`, `    const onChange = vi.fn();`, `    render(${jsx});`, `    await user.type(screen.getByLabelText(${label}), 'a');`, `    expect(onChange).toHaveBeenCalled();`, `  });`].join('\n'));
  }

  const usesScreen = tests.join('\n').includes('screen.');
  const vitestImports = ['describe', 'it', 'expect', usesVi && 'vi'].filter(Boolean).join(', ');
  const rtlImports = ['render', usesScreen && 'screen'].filter(Boolean).join(', ');
  const imports = [`import { ${vitestImports} } from 'vitest';`, `import { ${rtlImports} } from '@testing-library/react';`];
  if (usesUser) imports.push(`import userEvent from '@testing-library/user-event';`);

  const content = `// ${GENERATED_MARKER} — RTL unit test.
${imports.join('\n')}

${importLine}

describe('${name}', () => {
${tests.join('\n\n')}
});
`;

  return { filename: `${name}.test.tsx`, content };
}
