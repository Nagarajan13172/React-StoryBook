// platform/generators/stories-matrix.mjs
// ---------------------------------------------------------------------------
// Emits <Name>.states.stories.tsx — a CSF3 story file covering ONLY the states
// a component can actually express (Default/Loading/Disabled/Error/Empty/Dark/
// Mobile/Long). Each story is automatically a render + a11y test in the
// existing `storybook` Vitest browser project. Uses Storybook 10 globals for
// Dark (backgrounds) and Mobile (viewport) — no extra addons.
// ---------------------------------------------------------------------------
import { GENERATED_MARKER } from '../../scripts/lib/stories.mjs';
import { analyzeComponent, statesFor, serializeArgs } from './lib.mjs';

const DARK_EXTRA = `  globals: { backgrounds: { value: 'dark' } },
  parameters: {
    backgrounds: { options: { dark: { name: 'Dark', value: '#1a1a1a' } } },
  },`;

const MOBILE_EXTRA = `  globals: { viewport: { value: 'iphone6', isRotated: false } },
  parameters: { viewport: { options: INITIAL_VIEWPORTS } },`;

function storyBlock(state) {
  const lines = [`export const ${state.name}: Story = {`];
  lines.push(`  args: ${serializeArgs(state.args, '    ')},`);
  if (state.dark) lines.push(DARK_EXTRA);
  if (state.mobile) lines.push(MOBILE_EXTRA);
  lines.push(`};`);
  return lines.join('\n');
}

/** Returns { filename, content } for a component, or null if it has no props to vary. */
export function generateStatesStory(component) {
  const model = analyzeComponent(component);
  const states = statesFor(model);
  const { name, importStyle, needsFn } = model;

  const importLine = importStyle === 'default' ? `import ${name} from './${name}';` : `import { ${name} } from './${name}';`;
  const needsViewport = states.some((s) => s.mobile);

  const imports = [`import type { Meta, StoryObj } from '@storybook/react-vite';`];
  if (needsViewport) imports.push(`import { INITIAL_VIEWPORTS } from 'storybook/viewport';`);
  if (needsFn) imports.push(`import { fn } from 'storybook/test';`);

  const metaArgs = Object.keys(model.requiredArgs).length
    ? `\n  args: ${serializeArgs(model.requiredArgs, '    ')},`
    : '';

  const content = `${imports.join('\n')}

${importLine}

// ${GENERATED_MARKER} — state matrix.
// States emitted (derived from ${name}'s props): ${states.map((s) => s.name).join(', ')}.
const meta = {
  title: 'States/${name}',
  component: ${name},
  parameters: { layout: 'centered' },
  tags: ['autodocs'],${metaArgs}
} satisfies Meta<typeof ${name}>;

export default meta;
type Story = StoryObj<typeof meta>;

${states.map(storyBlock).join('\n\n')}
`;

  return { filename: `${name}.states.stories.tsx`, content, states: states.map((s) => s.name) };
}
