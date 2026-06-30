import type { Meta, StoryObj } from '@storybook/react-vite';
import { INITIAL_VIEWPORTS } from 'storybook/viewport';
import { NotFound } from './NotFound';
import { withRouter } from '../test/decorators';

const meta = {
  title: 'Pages/NotFound',
  component: NotFound,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  // The "Back to home" <Link> needs a router context.
  decorators: [withRouter],
} satisfies Meta<typeof NotFound>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = {
  globals: { backgrounds: { value: 'dark' } },
  parameters: { backgrounds: { options: { dark: { name: 'Dark', value: '#1a1a1a' } } } },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'iphone6', isRotated: false } },
  parameters: { viewport: { options: INITIAL_VIEWPORTS } },
};
