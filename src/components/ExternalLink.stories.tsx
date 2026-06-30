import type { Meta, StoryObj } from '@storybook/react-vite';
import { INITIAL_VIEWPORTS } from 'storybook/viewport';
import { ExternalLink } from './ExternalLink';

const LONG =
  'A very long link label used to verify how the anchor wraps across multiple lines without breaking the surrounding layout';

const meta = {
  title: 'Components/ExternalLink',
  component: ExternalLink,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { href: 'https://example.com', children: 'Visit example.com' },
} satisfies Meta<typeof ExternalLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A javascript: URL is neutralized — the rendered href falls back to "#". */
export const DangerousHrefNeutralized: Story = {
  args: { href: 'javascript:alert(1)', children: 'Looks legit' },
};

export const Dark: Story = {
  globals: { backgrounds: { value: 'dark' } },
  parameters: { backgrounds: { options: { dark: { name: 'Dark', value: '#1a1a1a' } } } },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'iphone6', isRotated: false } },
  parameters: { viewport: { options: INITIAL_VIEWPORTS } },
};

export const Long: Story = {
  args: { children: LONG },
};
