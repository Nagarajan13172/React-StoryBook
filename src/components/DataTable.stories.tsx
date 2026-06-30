import type { Meta, StoryObj } from '@storybook/react-vite';
import { INITIAL_VIEWPORTS } from 'storybook/viewport';
import { expect, userEvent, within } from 'storybook/test';
import { DataTable } from './DataTable';
import type { Column } from './DataTable';

interface Member extends Record<string, unknown> {
  name: string;
  role: string;
  age: number;
}

const columns: Column<Member>[] = [
  { key: 'name', header: 'Name' },
  { key: 'role', header: 'Role' },
  { key: 'age', header: 'Age' },
];

const rows: Member[] = [
  { name: 'Ada Lovelace', role: 'Engineer', age: 36 },
  { name: 'Grace Hopper', role: 'Admiral', age: 41 },
  { name: 'Linus Pauling', role: 'Chemist', age: 29 },
  { name: 'Margaret Hamilton', role: 'Director', age: 52 },
  { name: 'Katherine Johnson', role: 'Mathematician', age: 47 },
];

// Concrete instantiation of the generic component so Storybook's types resolve.
const MemberTable = DataTable<Member>;

const meta = {
  title: 'Components/DataTable',
  component: MemberTable,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { caption: 'Team members', columns, rows, pageSize: 3 },
} satisfies Meta<typeof MemberTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** No rows → the empty state row is shown instead of data. */
export const Empty: Story = { args: { rows: [] } };

export const Dark: Story = {
  globals: { backgrounds: { value: 'dark' } },
  parameters: { backgrounds: { options: { dark: { name: 'Dark', value: '#1a1a1a' } } } },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'iphone6', isRotated: false } },
  parameters: { viewport: { options: INITIAL_VIEWPORTS } },
};

/** Clicking a column header sorts by it and exposes the direction via aria-sort. */
export const SortsByColumn: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nameHeader = canvas.getByRole('columnheader', { name: /name/i });
    const sortButton = within(nameHeader).getByRole('button');

    await userEvent.click(sortButton);
    await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

    await userEvent.click(sortButton);
    await expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
  },
};
