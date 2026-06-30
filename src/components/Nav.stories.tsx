import type { Meta, StoryObj } from '@storybook/react-vite';
import { INITIAL_VIEWPORTS } from 'storybook/viewport';
import { Nav } from './Nav';
import { withRouter } from '../test/decorators';

const meta = {
  title: 'Components/Nav',
  component: Nav,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  // NavLink needs a router context.
  decorators: [withRouter],
} satisfies Meta<typeof Nav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** No items → an empty (but still labelled) nav landmark. */
export const Empty: Story = { args: { items: [] } };

export const Dark: Story = {
  globals: { backgrounds: { value: 'dark' } },
  parameters: { backgrounds: { options: { dark: { name: 'Dark', value: '#1a1a1a' } } } },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'iphone6', isRotated: false } },
  parameters: { viewport: { options: INITIAL_VIEWPORTS } },
};
