import type { Meta, StoryObj } from '@storybook/react-vite';
import { INITIAL_VIEWPORTS } from 'storybook/viewport';
import { BigList } from './BigList';
import type { BigListItem } from './BigList';

const items: BigListItem[] = Array.from({ length: 1000 }, (_, i) => ({
  id: i,
  label: `Item #${i + 1}`,
}));

const meta = {
  title: 'Components/BigList',
  component: BigList,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { items, pageSize: 50 },
} satisfies Meta<typeof BigList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 1000 items, but only `pageSize` rows are ever in the DOM. */
export const Default: Story = {};

export const Dark: Story = {
  globals: { backgrounds: { value: 'dark' } },
  parameters: { backgrounds: { options: { dark: { name: 'Dark', value: '#1a1a1a' } } } },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'iphone6', isRotated: false } },
  parameters: { viewport: { options: INITIAL_VIEWPORTS } },
};
